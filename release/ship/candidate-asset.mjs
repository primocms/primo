import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const targets = { linux_amd64: ['linux', 'x64'], linux_arm64: ['linux', 'arm64'], darwin_amd64: ['darwin', 'x64'], darwin_arm64: ['darwin', 'arm64'], 'windows_amd64.exe': ['win32', 'x64'] }
export function verifyCandidateAsset({ target, report, bytes, source, version }) {
	const platform = targets[target]
	if (!platform || !/^[a-f0-9]{40}$/.test(source || '')) throw new Error('Exact source and supported target are required')
	if (report.sourceCommit !== source || report.cms !== version || report.platform !== platform[0] || report.arch !== platform[1]) throw new Error('Qualification identity does not match the release')
	const sha256 = createHash('sha256').update(bytes).digest('hex')
	if (sha256 !== report.sha256) throw new Error('Qualified binary checksum mismatch')
	return sha256
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
