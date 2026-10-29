import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { verifyCandidateAsset } from '../../release/ship/candidate-asset.mjs'

const bytes = Buffer.from('qualified native fixture'), source = 'a'.repeat(40), version = 'v3.3.2-rc.13'
const report = { sourceCommit: source, cms: version, platform: 'linux', arch: 'x64', sha256: createHash('sha256').update(bytes).digest('hex') }
test('release retains exactly the native bytes that passed qualification', () => {
	assert.equal(verifyCandidateAsset({ target: 'linux_amd64', report, bytes, source, version }), report.sha256)
})
test('release rejects a rebuilt binary, stale source, wrong version or different platform', () => {
	for (const change of [{ bytes: Buffer.from('new build') }, { source: 'b'.repeat(40) }, { version: 'v3.3.2' }, { target: 'darwin_arm64' }, { target: '../linux_amd64' }, { source: undefined }]) {
		assert.throws(() => verifyCandidateAsset({ target: 'linux_amd64', report, bytes, source, version, ...change }))
	}
})
