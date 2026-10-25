import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../../src/lib/builder/views/editor/Toolbar.svelte', import.meta.url), 'utf8')
const body = source.slice(source.indexOf('async function handle_publish()'), source.indexOf('let going_up ='))
function publisher({ publishError, snapshotError, createError, deleteError, readOnly = false } = {}) {
	const events = []
	const warnings = []
	const collection = {
		create: async () => {
			events.push('save-snapshot')
			if (createError) throw createError
		},
		delete: async (id) => {
			events.push('delete-' + id)
			if (deleteError) throw deleteError
		}
	}
	const run = Function(
		'run_when_loaded',
		'publish',
		'create_snapshot',
		'$read_only',
		'existing_snapshots',
		'self',
		'site',
		'Snapshot',
		'toast',
		'console',
		'track_site_published',
		'track_operation_error',
		'categorize_error',
		`let publish_in_progress; ${body};return handle_publish`
	)(
		async (worker) => worker.run(),
		{
			run: async () => {
				events.push('publish')
				if (publishError) throw publishError
			}
		},
		{
			run: async () => {
				events.push('prepare-snapshot')
				if (snapshotError) throw snapshotError
				return {}
			}
		},
		readOnly,
		[{ id: 'previous' }],
		{
			instance: { collection: () => collection },
			invalidate_lists: () => events.push('refresh-snapshots'),
			commit: () => {
				throw new Error('Snapshot writes must not enter the editor commit queue')
			}
		},
		{ id: 'site' },
		{ encode: () => new Blob(['backup']) },
		{ warning: (message) => warnings.push(message) },
		{ warn: () => {} },
		() => events.push('published'),
		() => events.push('publish-error'),
		() => 'test'
	)
	return { run, events, warnings }
}
test('a snapshot upload failure keeps the previous snapshot and reports successful publication', async () => {
	const p = publisher({ createError: new Error('File too large') })
	await p.run()
	assert.deepEqual(p.events, ['publish', 'prepare-snapshot', 'save-snapshot', 'published'])
	assert.match(p.warnings[0], /Site published/)
})
test('snapshot preparation failure cannot turn an active publication into failure', async () => {
	const p = publisher({ snapshotError: new Error('Download failed') })
	await p.run()
	assert.deepEqual(p.events, ['publish', 'prepare-snapshot', 'published'])
	assert.equal(p.warnings.length, 1)
})
test('old snapshots are deleted only after the replacement is saved', async () => {
	const p = publisher()
	await p.run()
	assert.deepEqual(p.events, ['publish', 'prepare-snapshot', 'save-snapshot', 'delete-previous', 'refresh-snapshots', 'published'])
	assert.deepEqual(p.warnings, [])
})
test('cleanup failure retains the new snapshot without failing publication', async () => {
	const p = publisher({ deleteError: new Error('Delete failed') })
	await p.run()
	assert.equal(p.events.at(-1), 'published')
	assert.deepEqual(p.warnings, [])
})
test('actual publication failures still fail without changing snapshots', async () => {
	const error = new Error('Compile failed')
	const p = publisher({ publishError: error })
	await assert.rejects(p.run(), error)
	assert.deepEqual(p.events, ['publish', 'publish-error'])
	assert.deepEqual(p.warnings, [])
})
test('files-author mode publishes without creating a snapshot', async () => {
	const p = publisher({ readOnly: true })
	await p.run()
	assert.deepEqual(p.events, ['publish', 'published'])
})
