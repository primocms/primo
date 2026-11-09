import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { verifyCandidateAsset } from '../../release/ship/candidate-asset.mjs'

const bytes = Buffer.from('qualified native fixture'), source = 'a'.repeat(40), version = 'v3.3.2-rc.13'
const report = { sourceCommit: source, cms: version, platform: 'linux', arch: 'x64', sha256: createHash('sha256').update(bytes).digest('hex') }
test('release retains exactly the native bytes that passed qualification', () => {
	for (const version of ['v3.3.2', 'v3.3.2-rc.13']) {
		assert.equal(verifyCandidateAsset({ target: 'linux_amd64', report: { ...report, cms: version }, bytes, source, version }), report.sha256)
	}
})
test('release rejects a rebuilt binary, stale source, wrong version or different platform', () => {
	for (const change of [{ bytes: Buffer.from('new build') }, { source: 'b'.repeat(40) }, { version: 'v3.3.2' }, { target: 'darwin_arm64' }, { target: '../linux_amd64' }, { source: undefined }]) {
		assert.throws(() => verifyCandidateAsset({ target: 'linux_amd64', report, bytes, source, version, ...change }))
	}
})

test('published assets must match the independently retrieved successful run artifact', async () => {
 const { verifyPublishedCandidateAsset } = await import('../../release/ship/candidate-asset.mjs')
 const run={id:123,head_sha:source,conclusion:'success',event:'pull_request',path:'.github/workflows/rc-platform.yml',repository:{full_name:'primocms/primo'}}
 const options={repository:'primocms/primo',readRun:async()=>run,readArtifact:async()=>({bytes,report})}
 const input={target:'linux_amd64',report:{...report,qualificationRun:'123'},bytes,source,version}
 assert.equal(await verifyPublishedCandidateAsset(input,options),report.sha256)
 assert.equal(await verifyPublishedCandidateAsset(input,{...options,readRun:async()=>({...run,event:'workflow_dispatch'})}),report.sha256)
 const forged=Buffer.from('replacement matching its own forged report')
 await assert.rejects(verifyPublishedCandidateAsset({...input,bytes:forged,report:{...input.report,sha256:createHash('sha256').update(forged).digest('hex')}},options),/differs from the trusted/)
 for(const change of [{head_sha:'b'.repeat(40)},{conclusion:'failure'},{path:'.github/workflows/other.yml'},{event:'pull_request_target'},{repository:{full_name:'attacker/primo'}}]) {
 await assert.rejects(verifyPublishedCandidateAsset(input,{...options,readRun:async()=>({...run,...change})}),/Untrusted/)
 }
})
