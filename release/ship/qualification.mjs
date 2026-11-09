export async function requireQualification(github, context) {
	let native
	for (const workflow_id of ['rc-platform.yml', 'e2e.yml', 'browser-compatibility.yml', 'staging-preparation.yml']) {
		const response = await github.rest.actions.listWorkflowRuns({ ...context.repo, workflow_id, head_sha: context.sha, per_page: 100 })
		const run = response.data.workflow_runs.find((run) => ['pull_request', 'workflow_dispatch'].includes(run.event))
		if (!run || run.head_sha !== context.sha || run.conclusion !== 'success') throw new Error(`${workflow_id}: exact source has no current passing qualification`)
		if (workflow_id === 'rc-platform.yml') native = run.id
	}
	return native
}
