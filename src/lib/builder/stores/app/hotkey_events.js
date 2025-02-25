import { writable } from 'svelte/store'

function createEventDispatcher() {
	const { subscribe, update } = writable([])

	return {
		subscribe,
		dispatch: (event, detail) => {
			update((listeners) => {
				listeners.forEach((listener) => {
					if (listener.event === event) {
						listener.callback(detail)
					}
				})
				return listeners
			})
		},
		on: (event, callback) => {
			update((listeners) => [...listeners, { event, callback }])
			return () => {
				update((listeners) => listeners.filter((listener) => listener.callback !== callback))
			}
		}
	}
}

export default createEventDispatcher()
