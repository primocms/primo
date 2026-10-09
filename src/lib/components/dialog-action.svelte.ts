/** One pending action per small dialog; keep it open if the save fails. */
export function createDialogAction() {
	let busy = $state(false)
	let error = $state('')
	return {
		get busy() {
			return busy
		},
		get error() {
			return error
		},
		reset() {
			error = ''
		},
		async run(action: () => Promise<void>) {
			if (busy) return
			busy = true
			error = ''
			try {
				await action()
			} catch (cause) {
				error = cause instanceof Error ? cause.message : 'Could not save your changes. Please try again.'
			} finally {
				busy = false
			}
		}
	}
}
