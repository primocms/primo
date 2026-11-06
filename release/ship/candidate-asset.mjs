import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const targets = { linux_amd64: ['linux', 'x64'], linux_arm64: ['linux', 'arm64'], darwin_amd64: ['darwin', 'x64'], darwin_arm64: ['darwin', 'arm64'], 'windows_amd64.exe': ['win32', 'x64'] }
export function verifyCandidateAsset({ target, report, bytes, source, version }) {
	const platform = targets[target]
	if (!platform || !/^[a-f0-9]{40}$/.test(source || '')) throw new Error('Exact source and supported target are required')
	if (report.sourceCommit !== source || report.cms !== version || report.platform !== platform[0] || report.arch !== platform[1]) throw new Error('Qualification identity does not match the release')
	const sha256 = createHash('sha256').update(bytes).digest('hex')
	if (sha256 !== report.sha256) throw new Error('Qualified binary checksum mismatch')
	return sha256
}

// Release attachments are mutable together. Anchor them to the successful
// qualification run and its independently downloaded artifact before imaging.
export async function verifyPublishedCandidateAsset(input, { repository, readRun, readArtifact } = {}) {
	if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Repository is required')
	const runID = String(input.report.qualificationRun || '')
	if (!/^[1-9]\d*$/.test(runID)) throw new Error('Qualification run is required')
	const run = readRun ? await readRun(runID) : JSON.parse((await exec('gh', ['api', `repos/${repository}/actions/runs/${runID}`])).stdout)
	if (String(run.id) !== runID || run.head_sha !== input.source || run.conclusion !== 'success' || run.event !== 'pull_request' ||
		run.path !== '.github/workflows/rc-platform.yml' || run.repository?.full_name !== repository) throw new Error('Untrusted qualification run')
	const digest = verifyCandidateAsset(input)
	let temporary
	try {
		let trusted
		if (readArtifact) trusted = await readArtifact(runID, input.target)
		else {
			temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'primo-qualified-'))
			await exec('gh', ['run', 'download', runID, '--repo', repository, '--name', `rc13-${input.target}`, '--dir', temporary])
			trusted = {
				bytes: await fs.readFile(path.join(temporary, `primo_${input.target}`)),
				report: JSON.parse(await fs.readFile(path.join(temporary, 'platform-result.json'), 'utf8'))
			}
		}
		const qualified = verifyCandidateAsset({ ...input, ...trusted })
		if (digest !== qualified) throw new Error('Release binary differs from the trusted qualification artifact')
		return digest
	} finally {
		if (temporary) await fs.rm(temporary, { recursive: true, force: true })
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const [folder, target, destination] = process.argv.slice(2)
	const candidate = JSON.parse(await fs.readFile('tests/staging/rc8-packages.json', 'utf8'))
	if (candidate.cms.version !== process.env.GITHUB_REF_NAME) throw new Error('Tag must match the qualified candidate version')
	const report = JSON.parse(await fs.readFile(path.join(folder, 'platform-result.json'), 'utf8'))
	const name = `primo_${target}`, bytes = await fs.readFile(path.join(folder, name))
	const sha256 = verifyCandidateAsset({ target, report, bytes, source: process.env.GITHUB_SHA, version: candidate.cms.version })
	await fs.mkdir(destination, { recursive: true })
	await fs.writeFile(path.join(destination, name), bytes, { mode: 0o755 })
	await fs.writeFile(path.join(destination, `${name}.qualification.json`), JSON.stringify({ ...report, qualificationRun: process.env.PRIMO_QUALIFICATION_RUN }, null, 2) + '\n')
	console.log(`${sha256}  ${name}`)
}
