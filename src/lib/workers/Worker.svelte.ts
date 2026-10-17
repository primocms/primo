import { untrack } from 'svelte'

export type DoneCallback<V> = (error: unknown, value?: V) => void

export type SvelteWorker<P extends unknown[], V extends unknown> = {
	status: 'waiting' | 'standby' | 'loading' | 'working'
	run: (...params: P) => Promise<V>
}

export const useSvelteWorker = <P extends unknown[], V extends unknown>(ready: () => boolean, loaded: () => boolean, work: (...params: [...P]) => V | Promise<V>): SvelteWorker<P, V> => {
	let status = $state<'waiting' | 'standby' | 'loading' | 'working'>('standby')
	let parameters: P
	let done: DoneCallback<V>

	$effect(() => {
		if (status === 'waiting' && ready()) {
			status = 'standby'
		} else if (status === 'standby' && !ready()) {
			status = 'waiting'
		}

		if (status === 'loading' && loaded()) {
			status = 'working'
			untrack(() =>
				Promise.resolve()
					.then(() => work(...parameters))
					.then((value) => done?.(null, value))
					.catch((error) => done?.(error))
			)
		}
	})

	return {
		get status() {
			return status
		},

		async run(...params: P) {
			parameters = params
			if (status === 'standby') {
				status = 'loading'
			} else {
				throw new Error('Cannot run, worker not in standby')
			}

			return new Promise<V>((resolve, reject) => {
				done = (error, value) => {
					status = 'standby'
					if (error) {
						reject(error)
					} else {
						resolve(value!)
					}
				}
			})
		}
	}
}
