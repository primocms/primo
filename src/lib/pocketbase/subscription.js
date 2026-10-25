/**
 * Registration is asynchronous and navigation can cancel its request. Keep the
 * SDK's listeners/reconnect behavior; report actual server failures separately.
 * @param {Promise<unknown>} registration
 * @param {(error: unknown) => void} reportError
 */
export function observeSubscription(registration, reportError = (error) => console.error('Realtime subscription failed', error)) {
	return registration.then(() => {}, (error) => {
		const failure = /** @type {{isAbort?: boolean, status?: number} | null} */ (error)
		if (!failure?.isAbort && failure?.status !== 0) reportError(error)
	})
}
