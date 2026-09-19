import type { HandleClientError } from '@sveltejs/kit'
import { initialized } from '$lib/PostHog'
import { instance } from '$lib/instance'
import { track_uncaught_error } from '$lib/analytics'

export const handleError: HandleClientError = async ({ error, status }) => {
	// Only track errors if it's not a 404
	if (status === 404) {
		return
	}

	await initialized
	if (!instance.telemetry_enabled || instance.dev_mode) return
	// Never forward the raw error to PostHog: posthog.captureException would
	// transmit its message and stack trace, which can carry request-derived
	// URLs, content, or identifiers. Only a coarse category is sent.
	track_uncaught_error(error)
}
