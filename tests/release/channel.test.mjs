import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { releaseChannel } from '../../release/ship/release-channel.mjs'

const repository = 'primocms/primo'
test('RC publication only emits its exact version, preserving stable channels', () => {
	assert.deepEqual(releaseChannel({ tag: 'v3.3.2-rc.13', prerelease: true, repository }).tags, ['ghcr.io/primocms/primo:3.3.2-rc.13'])
})
test('stable publication retains exact, minor, major and latest channels', () => {
	assert.deepEqual(releaseChannel({ tag: 'v3.3.2', prerelease: false, repository }).tags, ['ghcr.io/primocms/primo:3.3.2', 'ghcr.io/primocms/primo:3.3', 'ghcr.io/primocms/primo:3', 'ghcr.io/primocms/primo:latest'])
})
test('mislabeled releases cannot promote a prerelease to stable', () => {
	for (const [tag, prerelease] of [['v3.3.2-rc.13', false], ['v3.3.2', true], ['v3.3.2-rc.13', undefined]]) {
		assert.throws(() => releaseChannel({ tag, prerelease, repository }))
	}
})
test('rejects non-version refs and output injection', () => {
	for (const tag of ['main', 'v3.3', 'v4.0.0', 'v3.3.02', 'v3.3.2\nlatest', 'v3.3.2+meta']) assert.throws(() => releaseChannel({ tag, prerelease: false, repository }))
	assert.throws(() => releaseChannel({ tag: 'v3.3.2', prerelease: false, repository: 'primocms/primo\ntags=latest' }))
})
test('actual workflow entry point writes only the approved tags and rejects drafts without output', async () => {
	const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'primo-release-channel-'))
	try {
		const event = path.join(folder, 'event.json'), output = path.join(folder, 'output')
		const script = fileURLToPath(new URL('../../release/ship/release-channel.mjs', import.meta.url))
		for (const draft of [false, true]) {
			await fs.writeFile(event, JSON.stringify({ release: { tag_name: 'v3.3.2-rc.13', prerelease: true, draft } }))
			await fs.writeFile(output, '')
			const run = spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output, GITHUB_REPOSITORY: repository } })
			assert.equal(run.status, draft ? 1 : 0, run.stderr)
			const written = await fs.readFile(output, 'utf8')
			if (draft) assert.equal(written, '')
			else { assert.match(written, /ghcr\.io\/primocms\/primo:3\.3\.2-rc\.13\n/); assert.doesNotMatch(written, /:latest|:3\.3\n|:3\n/) }
		}
	} finally { await fs.rm(folder, { recursive: true, force: true }) }
})
