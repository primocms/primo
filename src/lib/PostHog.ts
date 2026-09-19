import posthog from 'posthog-js/dist/module.no-external'
import 'posthog-js/dist/exception-autocapture'
import 'posthog-js/dist/tracing-headers'
import 'posthog-js/dist/web-vitals'
import { instance } from './instance'

const POSTHOG_KEY = 'phc_uh5ILOgLhZ4Pg5KLdrzTmiuZNLwsQeihA1Af1rTqNK1'
const POSTHOG_HOST = 'https://us.i.posthog.com'

export const initialized = (async () => {
	if (!instance.telemetry_enabled) {
		return
	}

	posthog.init(POSTHOG_KEY, {
		api_host: POSTHOG_HOST,

		// Privacy settings - disable all tracking features except events
		disable_session_recording: true,
		disable_surveys: true,
		disable_compression: false,
		disable_persistence: false,

		// Don't capture pageviews automatically
		capture_pageview: false,
		capture_pageleave: false,

		// Reduce data collection
		property_blacklist: ['$initial_referrer', '$initial_referring_domain'],

		// Set instance ID as distinct ID
		bootstrap: {
			distinctID: instance.id,
			isIdentifiedID: true
		}
	})
})()

export default posthog
