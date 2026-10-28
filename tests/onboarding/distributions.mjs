// Stage official runtime bytes once on Linux. Every native acceptance test still
// starts with no runtime, credentials or package cache and installs its own copy.
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
const execFile = promisify(execFileCallback)
const version = '22.17.0',
	base = `https://nodejs.org/dist/v${version}/`,
	root = path.resolve('node-distributions')
const names = ['linux-x64.tar.xz', 'linux-arm64.tar.xz', 'darwin-x64.tar.xz', 'darwin-arm64.tar.xz', 'win-x64.zip'].map((suffix) => `node-v${version}-${suffix}`)
const get = async (name) => {
	// This Linux staging job needs the same IPv4 OS HTTPS transport as the
	// clean-profile installers. Node fetch can stall against the distribution
	// host on hosted runners. Keep verified TLS and the original 120s budget.
	console.log('Staging official Node distribution: ' + name)
	const { stdout } = await execFile('/usr/bin/curl', [
		'--disable', '--ipv4', '--fail', '--silent', '--show-error', '--location',
		'--proto', '=https', '--proto-redir', '=https', '--tlsv1.2',
		'--connect-timeout', '15', '--max-time', '120', base + name
	], { encoding: 'buffer', timeout: 120000, maxBuffer: 128 * 1024 * 1024 })
	return stdout
}
const sums = (await get('SHASUMS256.txt')).toString('utf8')
await fs.mkdir(root, { recursive: true })
await fs.writeFile(path.join(root, 'SHASUMS256.txt'), sums)
const results = await Promise.allSettled(
	names.map(async (name) => {
		const bytes = await get(name),
			sha256 = createHash('sha256').update(bytes).digest('hex')
		assert.equal(
			sha256,
			sums
				.split('\n')
				.find((line) => line.endsWith('  ' + name))
				?.split(' ')[0],
			name + ' official checksum'
		)
		await fs.writeFile(path.join(root, name), bytes)
		return { name, url: base + name, sha256 }
	})
)
for (const result of results) if (result.status === 'rejected') throw result.reason
await fs.writeFile(
	path.join(root, 'provenance.json'),
	JSON.stringify({ sourceCommit: process.env.PRIMO_CANDIDATE_SHA, node: version, archives: results.map((result) => result.value) }, null, 2) + '\n'
)
console.log('Verified five official runtime distributions for isolated native installation.')
