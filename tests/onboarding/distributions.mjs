// GitHub's setup-node distribution mirror avoids slow nodejs.org CDN paths.
// Pinned archive hashes and byte-identical official executable hashes are in
// node-mirrors.json. Every platform still installs a new private runtime.
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
const pinned = JSON.parse(await fs.readFile(new URL('./node-mirrors.json', import.meta.url), 'utf8'))
const root = path.resolve('node-distributions')
await fs.mkdir(root, { recursive: true })
const results = await Promise.allSettled(
	pinned.mirrors.map(async (item) => {
		assert.equal(path.basename(item.name), item.name)
		assert.ok(item.url.startsWith('https://github.com/actions/node-versions/releases/download/22.17.0-15866718879/'))
		const response = await fetch(item.url, { signal: AbortSignal.timeout(120000) })
		assert.ok(response.ok, 'Maintained Node mirror HTTP ' + response.status)
		const bytes = Buffer.from(await response.arrayBuffer())
		assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.name + ' pinned mirror checksum')
		await fs.writeFile(path.join(root, item.name), bytes)
		return item
	})
)
for (const result of results) if (result.status === 'rejected') throw result.reason
await fs.writeFile(
	path.join(root, 'provenance.json'),
	JSON.stringify({ sourceCommit: process.env.PRIMO_CANDIDATE_SHA, node: pinned.node, archives: results.map((result) => result.value) }, null, 2) + '\n'
)
console.log('Verified five pinned runtime distributions; consumers also verify the official executable hashes.')
