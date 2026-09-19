/**
 * Primo product analytics
 *
 * Tracks a small set of completed operations (not clicks, not keystrokes) so
 * we can answer: who activates (creates -> publishes), how long that takes,
 * who returns on a later day, and what errors block activation.
 *
 * Privacy:
 * - Only opaque ids (instance.id, current_user.id) and enumerated properties
 *   below are sent. Never page/field content, emails, tokens, raw errors, or
 *   URLs.
 * - Gated on instance.telemetry_enabled (see PostHog.ts) and skipped entirely
 *   in dev_mode so local/test activity never reaches production metrics.
 * - Autocapture, session replay, and pageview capture stay off (PostHog.ts).
 * - Never throws: a tracking failure must not block editing/saving/publishing.
 */
import posthog, { initialized } from './PostHog'
import { instance } from './instance'
// Read the authed user straight from the PocketBase authStore rather than
// `pocketbase/user.ts`, which imports `pocketbase/managers.ts` — that module
// imports this file (to report content-save events), so going through it
// here would create an import cycle.
import { self as pb_instance } from './pocketbase/instances'

export const ANALYTICS_EVENTS = {
	SITE_CREATED: 'site_created',
	CONTENT_SAVED: 'content_saved',
	SITE_PUBLISHED: 'site_published',
	COLLABORATOR_ADDED: 'collaborator_added',
	OPERATION_FAILED: 'operation_failed'
} as const

type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

// Only these primitive-valued properties are ever sent. Anything else passed
// to track() is dropped rather than forwarded, so a future call site can't
// accidentally leak content by widening the payload.
type EventProperties = Record<string, string | number | boolean | undefined>

const sanitize_properties = (properties: EventProperties) => {
	const clean: Record<string, string | number | boolean> = {}
	for (const [key, value] of Object.entries(properties)) {
		if (value === undefined) continue
		if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue
		clean[key] = value
	}
	return clean
}

const should_track = () => {
	// instance.telemetry_enabled already gates whether PostHog initializes at
	// all (see PostHog.ts); this adds the dev/test exclusion so local
	// development and CI never post to the production project.
	return instance.telemetry_enabled && !instance.dev_mode
}

// Opaque PocketBase user record id for the signed-in editor, or undefined if
// no one is signed in yet. Never the email — just the id `user.ts` also uses.
const current_editor_id = () => pb_instance.authStore.record?.id as string | undefined

let identified_distinct_id = ''

// Identify the current editor (if signed in) as the PostHog distinct id, and
// attach the server/account instance id as a separate property so account-
// level activity (e.g. which server) can be distinguished from individual
// editor activity (who on that server did it).
const ensure_identified = () => {
	const distinct_id = current_editor_id() || instance.id
	if (distinct_id === identified_distinct_id) return
	identified_distinct_id = distinct_id

	posthog.identify(distinct_id, {
		instance_id: instance.id,
		hosted_mode: instance.hosted_mode
	})
}

const track = (event: AnalyticsEvent, properties: EventProperties = {}) => {
	if (!should_track()) return

	// Fire-and-forget: analytics must never block or reject the caller's own
	// await chain (editing/saving/publishing has to succeed independent of
	// whether the event reaches PostHog).
	void (async () => {
		try {
			await initialized
			if (!instance.telemetry_enabled) return // consent may have been read before init resolved

			ensure_identified()

			posthog.capture(event, {
				...sanitize_properties(properties),
				instance_id: instance.id,
				hosted_mode: instance.hosted_mode
			})
		} catch {
			// Swallow — analytics is best-effort.
		}
	})()
}

// De-dupes an event to at most once per local calendar day per key, so
// "returned to edit/publish on a different day" can be derived from ordinary
// save/publish events without a separate high-volume signal. Keyed by event
// + an id (e.g. site id) so multiple sites don't share one bucket.
const day_bucket_key = (event: AnalyticsEvent, key: string) => `primo_analytics_last_${event}_${key}`

const is_new_day = (event: AnalyticsEvent, key: string) => {
	if (typeof localStorage === 'undefined') return true
	const storage_key = day_bucket_key(event, key)
	const today = new Date().toISOString().slice(0, 10)
	const last = localStorage.getItem(storage_key)
	if (last === today) return false
	localStorage.setItem(storage_key, today)
	return true
}

/** A new site record was successfully created (server-confirmed). */
export const track_site_created = (properties: { site_id: string; source: 'local' | 'marketplace' | 'file' }) => {
	track(ANALYTICS_EVENTS.SITE_CREATED, {
		site_id: properties.site_id,
		source: properties.source
	})
}

/** A content field edit (site/page/section entry) was successfully persisted to the server. */
export const track_content_saved = () => {
	const dedup_key = current_editor_id() || instance.id
	const returning = is_new_day(ANALYTICS_EVENTS.CONTENT_SAVED, dedup_key)
	track(ANALYTICS_EVENTS.CONTENT_SAVED, {
		is_return_activity: returning
	})
}

/** A site publish completed successfully (compiled + committed). */
export const track_site_published = (properties: { site_id: string }) => {
	const returning = is_new_day(ANALYTICS_EVENTS.SITE_PUBLISHED, properties.site_id)
	track(ANALYTICS_EVENTS.SITE_PUBLISHED, {
		site_id: properties.site_id,
		is_return_activity: returning
	})
}

/** A collaborator was successfully added to a site (record created), whether by email invite or link. */
export const track_collaborator_added = (properties: { site_id: string; method: 'invite' | 'link' }) => {
	track(ANALYTICS_EVENTS.COLLABORATOR_ADDED, {
		site_id: properties.site_id,
		method: properties.method
	})
}

// Coarse, non-identifying buckets. Extend this list rather than passing raw
// messages through — an unmapped error still records as "unknown" instead of
// falling back to the raw string.
export type ErrorCategory = 'network' | 'validation' | 'permission' | 'compilation' | 'server' | 'unknown'

export const categorize_error = (error: unknown): ErrorCategory => {
	if (error instanceof TypeError && /fetch|network/i.test(error.message)) return 'network'
	const status = (error as { status?: number })?.status
	if (status === 401 || status === 403) return 'permission'
	if (status === 400 || status === 422) return 'validation'
	if (status && status >= 500) return 'server'
	const message = error instanceof Error ? error.message : String(error)
	if (/compil|generat/i.test(message)) return 'compilation'
	if (/network|fetch|offline/i.test(message)) return 'network'
	if (/permission|forbidden|unauthorized/i.test(message)) return 'permission'
	return 'unknown'
}

/** A save or publish operation failed in a way that blocked the user. Category only — never the raw error/message/URL. */
export const track_operation_error = (properties: { operation: 'site_create' | 'content_save' | 'publish' | 'collaborator_add'; category: ErrorCategory; site_id?: string }) => {
	track(ANALYTICS_EVENTS.OPERATION_FAILED, {
		operation: properties.operation,
		category: properties.category,
		site_id: properties.site_id
	})
}
