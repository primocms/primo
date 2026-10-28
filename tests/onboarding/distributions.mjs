// Stage official runtime bytes once on Linux. Every native acceptance test still
// starts with no runtime, credentials or package cache and installs its own copy.
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
const version = '22.17.0',
	base = `https://nodejs.org/dist/v${version}/`,
	root = path.resolve('node-distributions')
const names = ['linux-x64.tar.xz', 'linux-arm64.tar.xz', 'darwin-x64.tar.xz', 'darwin-arm64.tar.xz', 'win-x64.zip'].map((suffix) => `node-v${version}-${suffix}`)
const get = async (name) => {
	const response = await fetch(base + name, { signal: AbortSignal.timeout(120000) })
	assert.ok(response.ok, 'Official Node distribution HTTP ' + response.status)
	return Buffer.from(await response.arrayBuffer())
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
