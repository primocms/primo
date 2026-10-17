import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createPresenceScheduler} from '../../src/lib/user_activity_scheduler.js'

function fixture({update = async () => {}, remove = async () => {}} = {}) {
	const timers = new Map(), errors = []; let next = 0
	const scheduler = createPresenceScheduler({update, remove, reportError: error => errors.push(error), setTimer: (callback, delay) => {const id = ++next; timers.set(id, {callback, delay}); return id}, clearTimer: id => timers.delete(id)})
	return {scheduler, timers, errors, fire: async () => {const [id, task] = timers.entries().next().value; timers.delete(id); await task.callback()}}
}

test('navigation-aborted presence updates and cleanup settle without unhandled rejection', async () => {
	for (const failure of [{status: 0, isAbort: false, originalError: new TypeError('NetworkError')}, {status: 0, isAbort: true}]) {
		const f = fixture({update: async () => {throw failure}, remove: async () => {throw failure}})
		f.scheduler.start(); await f.fire()
		assert.equal(f.timers.size, 1, 'A transient failure must not permanently stop the heartbeat')
		await f.scheduler.stop(); await f.scheduler.dispose()
		assert.deepEqual(f.errors, []); assert.equal(f.timers.size, 0)
	}
})

test('unexpected presence failures are reported and the next heartbeat can succeed', async () => {
	let calls = 0; const failure = {status: 503}
	const f = fixture({update: async () => {if (++calls === 1) throw failure}})
	f.scheduler.start(); await f.fire(); await f.fire()
	assert.equal(calls, 2); assert.deepEqual(f.errors, [failure]); await f.scheduler.dispose()
})

test('a pending presence response cannot restart a hidden or destroyed tracker', async () => {
	for (const action of ['stop', 'dispose']) {
		let complete; const pending = new Promise(resolve => {complete = resolve})
		const f = fixture({update: () => pending})
		f.scheduler.start(); const update = f.fire(); await f.scheduler[action](); complete(); await update
		assert.equal(f.timers.size, 0)
		if (action === 'dispose') {f.scheduler.start(); f.scheduler.refresh(); assert.equal(f.timers.size, 0)}
	}
})

test('a hidden tab resumes once and repeated starts do not duplicate timers', async () => {
	let calls = 0
	const f = fixture({update: async () => {calls++}})
	f.scheduler.start(); f.scheduler.start(); assert.equal(f.timers.size, 1)
	await f.fire(); assert.equal(calls, 1); assert.equal([...f.timers.values()][0].delay, 5000)
	await f.scheduler.stop(); f.scheduler.refresh(); assert.equal(f.timers.size, 0)
	f.scheduler.start(); assert.equal([...f.timers.values()][0].delay, 500); await f.fire(); assert.equal(calls, 2)
	await f.scheduler.dispose()
})

test('a callback queued before destruction cannot write presence afterwards', async () => {
	let calls = 0
	const f = fixture({update: async () => {calls++}})
	f.scheduler.start(); const callback = [...f.timers.values()][0].callback
	await f.scheduler.dispose(); await callback()
	assert.equal(calls, 0); assert.equal(f.timers.size, 0)
})

test('new context changes replace older pending heartbeat schedules', async () => {
	const completions = []
	const f = fixture({update: () => new Promise(resolve => completions.push(resolve))})
	f.scheduler.start(); const first = f.fire(); f.scheduler.refresh()
	completions[1](); await new Promise(resolve => setImmediate(resolve)); assert.equal(f.timers.size, 1)
	completions[0](); await first; assert.equal(f.timers.size, 1)
	await f.scheduler.dispose()
})
