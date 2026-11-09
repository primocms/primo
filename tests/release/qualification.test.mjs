import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { load } from 'js-yaml'

const workflow = load(await fs.readFile(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8'))
const script = workflow.jobs.candidate.steps.find((step) => step.id === 'qualified').with.script
const qualify = new (Object.getPrototypeOf(async function () {}).constructor)('github', 'context', 'core', script)
const source = 'a'.repeat(40)
const passing = { id: 123, head_sha: source, event: 'pull_request', conclusion: 'success' }

async function runQualification(runs = {}) {
	const output = {}, queried = []
	await qualify({ rest: { actions: { listWorkflowRuns: async ({ workflow_id, head_sha }) => {
		assert.equal(head_sha, source)
		queried.push(workflow_id)
		return { data: { workflow_runs: runs[workflow_id] ?? [passing] } }
	} } } }, { sha: source, repo: { owner: 'primocms', repo: 'primo' } }, { setOutput: (key, value) => { output[key] = value } })
	return { output, queried }
}

test('release requires every qualification suite at the tagged source', async () => {
	const { output, queried } = await runQualification()
	assert.deepEqual(queried, ['rc-platform.yml', 'e2e.yml', 'browser-compatibility.yml', 'staging-preparation.yml'])
	assert.deepEqual(output, { run: 123 })
	for (const workflow of queried) {
		for (const badRun of [null, { conclusion: 'failure' }, { conclusion: null }, { head_sha: 'b'.repeat(40) }, { event: 'pull_request_target' }]) {
			await assert.rejects(runQualification({ [workflow]: badRun ? [{ ...passing, ...badRun }] : [] }), /no current passing qualification/)
		}
	}
})

test('post-merge dispatch qualification works, but a newer failure blocks older success', async () => {
	assert.equal((await runQualification({ 'rc-platform.yml': [{ ...passing, event: 'workflow_dispatch' }] })).output.run, 123)
	await assert.rejects(runQualification({ 'rc-platform.yml': [{ ...passing, id: 456, conclusion: 'failure' }, passing] }), /no current passing qualification/)
})
