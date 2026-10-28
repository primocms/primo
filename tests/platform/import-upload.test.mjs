// Coordinated contract mirrored from primo-cli/tests/import-upload-cms.test.mjs.
// Uses the exact installed release archive on each native candidate platform.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs/promises'
import path from 'node:path'
import { make_workspace, run_cli } from './helpers/batched-cli.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('real CMS through 256 KiB proxy: >32 MiB pull/push, replay, preview, library, stale commit', {
	skip: !process.env.PRIMO_TEST_CMS_BINARY, timeout: 240000
}, async t => {
	const workspace = await make_workspace()
	const reservation = net.createServer()
	await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
	const port = reservation.address().port
	await new Promise(resolve => reservation.close(resolve))
	const upstream = `http://127.0.0.1:${port}`
	const dataDir = path.join(workspace.root, 'pb_data')
	const child = spawn(path.resolve(process.env.PRIMO_TEST_CMS_BINARY), ['serve', '--http', `127.0.0.1:${port}`, '--dir', dataDir], {
		env: { ...process.env, PRIMO_DEV_MODE: '1', PRIMO_AUTHOR_MODE: 'both', PRIMO_ENABLE_USAGE_STATS: 'false' }, stdio: ['ignore', 'pipe', 'pipe']
	})
	let logs = '', proxyError, rejected = 0, replayed = false, loseAcknowledgement = true, beforeCommit
	const staged = [], committed = [], acceptedSizes = []
	child.stdout.on('data', b => logs += b); child.stderr.on('data', b => logs += b)
	const proxy = http.createServer(async (request, response) => {
		try {
			if (Number(request.headers['content-length']) > 256 * 1024) {
				rejected++; request.resume(); response.writeHead(413); response.end('Proxy request limit'); return
			}
			const parts = []; let size = 0
			for await (const part of request) { parts.push(part); size += part.length }
			assert.ok(size <= 256 * 1024, 'an oversized body reached the proxy forwarding path')
			const body = Buffer.concat(parts)
			const isChunk = request.method === 'PUT' && request.url.startsWith('/api/primo/import-uploads/')
			const isCommit = request.method === 'POST' && !request.url.startsWith('/api/primo/import-uploads') && body.includes(Buffer.from('name="upload_id"'))
			if (isCommit && beforeCommit) { const hook = beforeCommit; beforeCommit = undefined; await hook() }
			const headers = { ...request.headers }; delete headers.host; delete headers.connection
			const result = await fetch(upstream + request.url, { method: request.method, headers, body: body.length ? body : undefined, redirect: 'manual' })
			const resultBody = Buffer.from(await result.arrayBuffer())
			if (request.method === 'POST' && request.url === '/api/primo/import-uploads' && result.ok) staged.push(JSON.parse(body))
			if (isChunk && result.ok) {
				acceptedSizes.push(size)
				if (loseAcknowledgement) { loseAcknowledgement = false; replayed = true; response.writeHead(503); response.end('Lost acknowledgement'); return }
			}
			if (isCommit) committed.push({ path: request.url, status: result.status, bytes: size })
			const resultHeaders = Object.fromEntries(result.headers); delete resultHeaders['content-encoding']; delete resultHeaders['transfer-encoding']
			resultHeaders['content-length'] = String(resultBody.length)
			response.writeHead(result.status, resultHeaders); response.end(resultBody)
		} catch (error) { proxyError = error; response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Proxy fixture failed') }
	})
	await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
	const server = `http://127.0.0.1:${proxy.address().port}`
	t.after(async () => {
		proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve))
		if (child.exitCode === null) { const closed = new Promise(resolve => child.once('close', resolve)); child.kill('SIGTERM'); await closed }
		await workspace.cleanup()
	})
	let ready = false
	for (let n = 0; n < 100; n++) {
		try { if ((await fetch(`${upstream}/api/health`)).ok) { ready = true; break } } catch {}
		if (child.exitCode !== null) break
		await delay(100)
	}
	assert.ok(ready, logs)
	const siteID = 'chunkpush000001'
	const site = path.join(workspace.work, 'sites/demo')
	const files = {
		'server.yaml': `server: ${server}\n`,
		'sites/demo/site.yaml': `name: Demo\nsite_id: ${siteID}\nserver: ${server}\n`,
		'sites/demo/blocks/hero/config.yaml': 'name: Hero\n',
		'sites/demo/blocks/hero/component.svelte': '<h1>{heading}</h1>\n',
		'sites/demo/blocks/hero/fields.yaml': '- name: heading\n  type: text\n',
		'sites/demo/page-types/default/config.yaml': 'name: Default\nallowed_blocks: [hero]\n',
		'sites/demo/pages/index.yaml': 'name: Home\npage_type: Default\nsections:\n  - block: hero\n    content:\n      heading: Original\n'
	}
	for (const [name, contents] of Object.entries(files)) {
		await fs.mkdir(path.dirname(path.join(workspace.work, name)), { recursive: true })
		await fs.writeFile(path.join(workspace.work, name), contents)
	}
	await fs.mkdir(path.join(site, 'uploads'))
	const expectedHashes = []
	// Nine individually valid 4 MiB files exceed the old 32 MiB archive limit.
	// Every individual file also exceeds this proxy's request-body cap.
	for (let n = 0; n < 9; n++) {
		const bytes = randomBytes(4 * 1024 * 1024)
		expectedHashes.push(hash(bytes)); await fs.writeFile(path.join(site, 'uploads', `asset-${n}.bin`), bytes)
	}
	const cli = args => run_cli(args, { cwd: workspace.work, home: workspace.home, timeout_ms: 90000 })
	const initial = await cli(['push'])
	assert.equal(initial.code, 0, initial.output)
	assert.ok(staged[0].size > 32 * 1024 * 1024)
	assert.equal(staged[0].endpoint, '/api/primo/bootstrap')
	assert.ok(rejected >= 2); assert.ok(replayed)
	const token = (await fetch(`${upstream}/api/primo/dev-auth`, { method: 'POST' }).then(r => r.json())).token
	assert.ok(token)
	const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
	const get = route => fetch(upstream + route, { headers }).then(r => r.json())
	const uploadsBefore = (await get('/api/collections/site_uploads/records')).items
	assert.equal(uploadsBefore.length, 9)
	const actualHashes = []
	for (const upload of uploadsBefore) {
		const response = await fetch(`${upstream}/api/files/site_uploads/${upload.id}/${upload.file}`)
		assert.equal(response.status, 200); actualHashes.push(hash(Buffer.from(await response.arrayBuffer())))
	}
	assert.deepEqual(actualHashes.sort(), expectedHashes.sort())
	const pulled = await cli(['pull', server, workspace.work, '--token', token])
	assert.equal(pulled.code, 0, pulled.output)
	const pushed = await cli(['push', '--token', token])
	assert.equal(pushed.code, 0, pushed.output)
	const uploadsAfter = (await get('/api/collections/site_uploads/records')).items
	assert.deepEqual(uploadsAfter.map(u => [u.id, u.file]).sort(), uploadsBefore.map(u => [u.id, u.file]).sort(), 'repeat upload must retain file records and names')
	const beforePreview = await get(`/api/primo/push-state/${siteID}`)
	const preview = await cli(['push', '--preview', '--token', token])
	assert.equal(preview.code, 0, preview.output)
	assert.equal((await get(`/api/primo/push-state/${siteID}`)).revision, beforePreview.revision)
	// Exercise both standalone library push and whole-workspace library push.
	const lib = path.join(workspace.work, 'library/shared/banner')
	await fs.mkdir(lib, { recursive: true })
	await fs.writeFile(path.join(workspace.work, 'library/groups.yaml'), '- name: Shared\n  folder: shared\n')
	await fs.writeFile(path.join(lib, 'config.yaml'), 'name: Banner\n')
	for (let n = 0; n < 8; n++) {
		const block = path.join(workspace.work, 'library/shared', `banner-${n}`)
		await fs.mkdir(block, { recursive: true })
		await fs.writeFile(path.join(block, 'config.yaml'), `name: Banner ${n}\n`)
		await fs.writeFile(path.join(block, 'component.svelte'), `<p>Banner</p><!-- ${randomBytes(48 * 1024).toString('base64')} -->`)
	}
	await fs.writeFile(path.join(lib, 'component.svelte'), '<p>Banner</p>')
	const library = await cli(['library', 'push', server, '--token', token])
	assert.equal(library.code, 0, library.output)
	const all = await cli(['push', '--token', token])
	assert.equal(all.code, 0, all.output)
	assert.ok(staged.filter(s => s.endpoint === '/api/primo/import-library').length >= 2)
	// A client changes content after CLI preflight but before the final import.
	const entry = (await get('/api/collections/page_section_entries/records')).items[0]
	beforeCommit = async () => {
		const response = await fetch(`${upstream}/api/collections/page_section_entries/records/${entry.id}`, { method: 'PATCH', headers, body: JSON.stringify({ value: 'Client edit during upload' }) })
		assert.equal(response.status, 200, await response.text())
	}
	const stale = await cli(['push', '--token', token, '--only', 'demo'])
	assert.equal(stale.code, 1, stale.output)
	assert.match(stale.output, /server changes|changed on the server/)
	assert.equal((await get(`/api/collections/page_section_entries/records/${entry.id}`)).value, 'Client edit during upload')
	assert.equal(committed.at(-1).status, 409)
	assert.ok(committed.some(c => c.path.endsWith('/preview') && c.status === 200))
	assert.ok(acceptedSizes.length > 100)
	assert.ok(Math.max(...acceptedSizes) <= 256 * 1024)
	assert.deepEqual(await fs.readdir(path.join(dataDir, '.import-uploads')), [])
	assert.equal(proxyError, undefined)
})
