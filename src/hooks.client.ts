import type { HandleClientError } from '@sveltejs/kit'
import { initialized } from '$lib/PostHog'
import { instance } from '$lib/instance'
import { track_uncaught_error } from '$lib/analytics'

export const handleError: HandleClientError = ({ error, status, message }) => {
	if (status !== 404) {
		// Retain the original error in the local browser console for diagnosis.
		// Only the categorical event below is sent to telemetry.
		console.error('Primo client error:', error)
		void initialized.then(() => {
			if (!instance.telemetry_enabled || instance.dev_mode) return
			track_uncaught_error(error)
		}).catch(() => {
			// Reporting must not delay, erase or reject the actual error view.
		})
	}

	// SvelteKit applies its fallback before awaiting the hook. An async hook
	// resolving undefined suppresses that fallback and leaves a blank page.
	return { message }
}
