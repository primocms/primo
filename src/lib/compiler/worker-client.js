/**
 * Firefox can interrupt Rollup's native regexp execution with an InternalError.
 * Retry once in a fresh worker; ordinary build errors remain build errors.
 * Retired workers finish their other requests before termination so no transport
 * promises are abandoned. Each request has its own fixed retry budget.
 * @param {() => {postMessage: (value: any) => Promise<any>, terminate: () => void}} createWorker
 */
export function createCompilerClient(createWorker) {
	/** @type {{worker: ReturnType<typeof createWorker>, active: number, retired: boolean} | undefined} */
	let current
	return async function compile(value) {
		for (let attempt = 0; attempt < 2; attempt++) {
			const session = current ||= { worker: createWorker(), active: 0, retired: false }
			session.active++
			try {
				const result = await session.worker.postMessage(value)
				if (result?.failureKind === 'engine-recursion') {
					session.retired = true
					if (current === session) current = undefined
				}
				if (session.retired && attempt === 0) continue
				return result
			} finally {
				session.active--
				if (session.retired && session.active === 0) session.worker.terminate()
			}
		}
	}
}
