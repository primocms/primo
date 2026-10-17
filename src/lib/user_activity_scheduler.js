/**
 * Collaborator presence is best effort and uses its own collection manager.
 * Navigation can abort its requests; content-save failures must still propagate.
 * @param {{ update: () => Promise<void>, remove: () => Promise<void>, reportError?: (error: unknown) => void, setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout }} options
 */
export function createPresenceScheduler({ update, remove, reportError = (error) => console.warn('Could not update collaborator presence', error), setTimer = setTimeout, clearTimer = clearTimeout }) {
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timer
	let running = false
	let disposed = false
	let generation = 0
	/** @param {() => Promise<void>} operation */
	const safely = async (operation) => {
		try {
			await operation()
		} catch (error) {
			const failure = /** @type {{isAbort?: boolean, status?: number} | null} */ (error)
			if (!failure?.isAbort && failure?.status !== 0) reportError(error)
		}
	}
	const clear = () => {
		clearTimer(timer)
		timer = undefined
	}
	const tick = async () => {
		if (!running || disposed) return
		clear()
		const current = generation
		await safely(update)
		// A pending response must not restart tracking after hide or destruction.
		if (running && !disposed && current === generation) timer = setTimer(tick, 5000)
	}
	const stop = () => {
		running = false
		generation++
		clear()
		return safely(remove)
	}
	return {
		start() {
			if (disposed || running) return
			running = true
			generation++
			timer = setTimer(tick, 500)
		},
		refresh() {
			if (!running || disposed) return
			generation++
			void tick()
		},
		stop,
		dispose() {
			disposed = true
			return stop()
		}
	}
}
