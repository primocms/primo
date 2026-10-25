import posthog from 'posthog-js/dist/module.no-external'
import 'posthog-js/dist/exception-autocapture'
import 'posthog-js/dist/tracing-headers'
import 'posthog-js/dist/web-vitals'
import { instance, instance_ready } from './instance'

const POSTHOG_KEY = 'phc_BjtMaGQMikAbssG6oaMrrksEB9m5J825kJZnwR8Qx87B'
const POSTHOG_HOST = 'https://us.i.posthog.com'

// The SDK adds current, initial, and session-entry URLs to event/person
// properties. Auth URLs can contain invitation/reset tokens or email addresses.
// Remove these from every property bag before any capture leaves the browser.
const strip_url_properties = (properties?: Record<string, unknown>) => {
	if (!properties) return
	for (const key of Object.keys(properties)) {
		if (/^\$(?:(?:initial|session_entry|session_exit)_)?(?:current_url|url|pathname|host|referrer|referring_domain)$/.test(key)) {
			delete properties[key]
		}
	}
}

export const initialized = (async () => {
	// Settings are loaded by the client startup barrier, not module evaluation.
	// A failed barrier prevents startup and must not start telemetry.
	try { await instance_ready } catch { return }
	if (!instance.telemetry_enabled || instance.dev_mode) {
		return
	}

	posthog.init(POSTHOG_KEY, {
		api_host: POSTHOG_HOST,

		// We use explicit analytics only. Flag requests include initial URL
		// properties outside before_send, so disable those unused requests too.
		advanced_disable_flags: true,

		// Capture explicit product events only.
		autocapture: false,
		disable_session_recording: true,
		disable_surveys: true,
		disable_compression: false,
		disable_persistence: false,

		// Don't capture pageviews automatically
		capture_pageview: false,
		capture_pageleave: false,

		// Reduce data collection
		before_send: (event) => {
			if (!event) return event
			strip_url_properties(event.properties)
			strip_url_properties(event.$set)
			strip_url_properties(event.$set_once)
			strip_url_properties(event.properties.$set)
			strip_url_properties(event.properties.$set_once)
			return event
		},

		// Set instance ID as distinct ID
		bootstrap: {
			distinctID: instance.id,
			isIdentifiedID: true
		}
	})
})()

export default posthog
