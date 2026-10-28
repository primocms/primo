// GitHub's setup-node distribution mirror avoids slow nodejs.org CDN paths.
// Pinned archive hashes and byte-identical official executable hashes are in
// node-mirrors.json. Every platform still installs a new private runtime.
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
const execFile = promisify(execFileCallback)
const pinned = JSON.parse(await fs.readFile(new URL('./node-mirrors.json', import.meta.url), 'utf8'))
const root = path.resolve('node-distributions')
await fs.mkdir(root, { recursive: true })
const results = await Promise.allSettled(
	pinned.mirrors.map(async (item) => {
		assert.equal(path.basename(item.name), item.name)
		assert.ok(item.url.startsWith('https://github.com/actions/node-versions/releases/download/22.17.0-15866718879/'))
		// Preserve the concurrent staging fix: verified IPv4 OS HTTPS, no curlrc,
		// redirects restricted to HTTPS, and the original 120-second budget.
		console.log('Staging pinned Node distribution: ' + item.name)
		const { stdout } = await execFile(
			'/usr/bin/curl',
			[
				'--disable',
				'--ipv4',
				'--fail',
				'--silent',
				'--show-error',
				'--location',
				'--proto',
				'=https',
				'--proto-redir',
				'=https',
				'--tlsv1.2',
				'--connect-timeout',
				'15',
				'--max-time',
				'120',
				item.url
			],
			{ encoding: 'buffer', timeout: 120000, maxBuffer: 128 * 1024 * 1024 }
		)
		assert.equal(createHash('sha256').update(stdout).digest('hex'), item.sha256, item.name + ' pinned mirror checksum')
		await fs.writeFile(path.join(root, item.name), stdout)
		return item
	})
)
for (const result of results) if (result.status === 'rejected') throw result.reason
await fs.writeFile(
	path.join(root, 'provenance.json'),
	JSON.stringify({ sourceCommit: process.env.PRIMO_CANDIDATE_SHA, node: pinned.node, archives: results.map((result) => result.value) }, null, 2) + '\n'
)
console.log('Verified five pinned runtime distributions; consumers also verify the official executable hashes.')
