import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import { createHash } from 'node:crypto'
import { freshInstall, stop, until, call, exec } from '../onboarding/fresh-install.mjs'

test('fresh profile installs Node and exact packages, connects MCP, builds and recovers both authoring modes', { timeout: 420000 }, async () => {
	const ws = await freshInstall()
	let dev, mcp, busy
	try {
		await ws.run(['init', '--no-mcp'])
		await ws.run(['new', 'first-site', '--skip-dev'])
		const site = path.join(ws.work, 'sites/first-site')
		assert.match(await fs.readFile(path.join(ws.work, 'AGENTS.md'), 'utf8'), /Primo/i)
		// Preserve another configured tool while wiring only the chosen agent client.
		const configPath = path.join(ws.work, '.cursor/mcp.json')
		await fs.mkdir(path.dirname(configPath), { recursive: true })
		const other = { command: 'existing-tool', args: ['keep-me'] }
		await fs.writeFile(configPath, JSON.stringify({ mcpServers: { existing: other } }))
		await ws.run(['mcp', 'install', '--client', 'cursor', '--project', '--json'])
		const configured = JSON.parse(await fs.readFile(configPath, 'utf8')).mcpServers
		assert.deepEqual(configured.existing, other)
		assert.equal(configured.primo.command, 'primo-mcp')
		mcp = await ws.connect(configured.primo)
		await call(mcp, 'list_docs')
		ws.evidence.checks.push(
			'fresh official Node installation',
			'exact npm archives installed without cache',
			'existing client configuration retained',
			'configured MCP launches and list_docs succeeds'
		)
		// A foreign listener must survive the agent diagnosing a busy configured port.
		busy = net.createServer((socket) => socket.destroy())
		await new Promise((resolve) => busy.listen(0, '127.0.0.1', resolve))
		const blocked = busy.address().port
		await fs.writeFile(path.join(ws.work, 'server.yaml'), `port: ${blocked}\n`)
		const refused = await ws.run(['dev', '--author', 'files']).then(
			() => null,
			(error) => error
		)
		assert.ok(refused, 'a configured occupied port must fail safely')
		assert.match(refused.stdout + refused.stderr, /port.*in use/i)
		assert.equal(busy.listening, true)
		let selected
		for (let attempt = 0; attempt < 50; attempt++) {
			const first = net.createServer(),
				second = net.createServer()
			await new Promise((resolve) => first.listen(0, '127.0.0.1', resolve))
			const port = first.address().port
			if (port >= 65535) {
				await new Promise((resolve) => first.close(resolve))
				continue
			}
			try {
				await new Promise((resolve, reject) => {
					second.once('error', reject)
					second.listen(port + 1, '127.0.0.1', resolve)
				})
				selected = port
			} catch (error) {
				if (error.code !== 'EADDRINUSE') throw error
			} finally {
				await new Promise((resolve) => first.close(resolve))
				if (second.listening) await new Promise((resolve) => second.close(resolve))
			}
			if (selected) break
		}
		assert.ok(selected, 'agent could not select a free port pair')
		const start = async (mode) => {
			dev = ws.start(['dev', '--author', mode, '--port', String(selected)])
			let state
			await until(async () => {
				assert.equal(dev.exitCode, null, dev.output)
				try {
					state = JSON.parse((await ws.run(['status', '--json'])).stdout)
					return state.running && state.sites.length === 1 && state.sites.every((s) => s.in_cms && s.sync?.ok)
				} catch {
					return false
				}
			}, 'development server did not become ready')
			console.log('Fresh profile: ' + mode + ' development server is ready')
			assert.equal(path.resolve(state.workspace), path.resolve(ws.work))
			assert.notEqual(state.port, blocked)
			assert.equal(busy.listening, true)
			assert.equal(state.process_alive, true)
			await call(mcp, 'get_dev_status', { site_path: site })
			return { state, url: `http://127.0.0.1:${state.port}` }
		}
		let { state, url } = await start('files')
		assert.ok(
			ws.requests.some((route) => route.startsWith('/primo_')),
			'managed CMS download was bypassed'
		)
		assert.equal(
			createHash('sha256')
				.update(await fs.readFile(ws.managedBinary))
				.digest('hex'),
			ws.evidence.cmsSha256
		)
		assert.match((await exec(ws.managedBinary, ['--version'], { env: ws.env })).stdout, /v3\.3\.2-rc\.13/)
		const duplicate = await ws.run(['dev', '--author', 'files']).then(
			() => null,
			(error) => error
		)
		assert.ok(duplicate, 'duplicate startup must fail')
		assert.match(duplicate.stdout + duplicate.stderr, /already|running|session/i)
		assert.equal(JSON.parse((await ws.run(['status', '--json'])).stdout).pid, state.pid)
		const auth = await fetch(url + '/api/primo/dev-auth', { method: 'POST' }).then((r) => r.json())
		const api = async (route, body) => {
			const r = await fetch(url + route, {
				method: body ? 'PATCH' : 'GET',
				headers: { Authorization: 'Bearer ' + auth.token, 'Content-Type': 'application/json' },
				body: body ? JSON.stringify(body) : undefined
			})
			assert.ok(r.ok, route + ' ' + r.status)
			return r.json()
		}
		const component = path.join(site, 'blocks', (await fs.readdir(path.join(site, 'blocks')))[0], 'component.svelte')
		const source = await fs.readFile(component, 'utf8')
		await fs.writeFile(component, source + '\n<!-- fresh-machine-import -->\n')
		await until(async () => (await api('/api/collections/site_symbols/records?perPage=200')).items.some((b) => b.html.includes('fresh-machine-import')), 'file edit was not imported')
		ws.evidence.checks.push(
			'normal managed CMS download matches frozen hash',
			'occupied configured port fails safely and agent selects a free pair',
			'files mode import',
			'duplicate startup refused without stopping active server'
		)
		await mcp.close()
		mcp = await ws.connect(configured.primo)
		const restartedAgentStatus = await call(mcp, 'get_dev_status', { site_path: site })
		assert.ok(restartedAgentStatus)
		assert.equal(JSON.parse((await ws.run(['status', '--json'])).stdout).pid, state.pid)
		await stop(dev)
		assert.equal(JSON.parse((await ws.run(['status', '--json'])).stdout).running, false)
		await ws.installPinnedCMS()
		ws.evidence.checks.push('exact tagged CMS installation for prereleases outside latest stable')
		;({ state, url } = await start('cms'))
		// An actual CMS source edit must reach the same file in visual-author mode.
		const visualAuth = await fetch(url + '/api/primo/dev-auth', { method: 'POST' }).then((r) => r.json())
		const block = (await fetch(url + '/api/collections/site_symbols/records?perPage=200', { headers: { Authorization: 'Bearer ' + visualAuth.token } }).then((r) => r.json())).items.find((b) =>
			b.html.includes('fresh-machine-import')
		)
		assert.ok(block)
		const updated = await fetch(url + '/api/collections/site_symbols/records/' + block.id, {
			method: 'PATCH',
			headers: { Authorization: 'Bearer ' + visualAuth.token, 'Content-Type': 'application/json' },
			body: JSON.stringify({ html: block.html + '<p>visual-mode-edit</p>' })
		})
		assert.ok(updated.ok, await updated.clone().text())
		assert.match((await updated.json()).html, /visual-mode-edit/)
		await until(async () => (await fs.readFile(component, 'utf8')).includes('visual-mode-edit'), 'visual edit did not reach files')
		const preview = await ws.run(['preview', '--dir', site])
		assert.match(preview.stdout, /preview|built|http/i)
		const response = await fetch(url + '/?_site=' + state.sites[0].site_id)
		assert.ok(response.ok)
		assert.match(await response.text(), /visual-mode-edit/)
		await call(mcp, 'get_dev_logs', { site_path: site })
		await stop(dev)
		;({ state, url } = await start('files'))
		assert.match(await fs.readFile(component, 'utf8'), /visual-mode-edit/)
		await ws.run(['build', '--dir', site, '--output', path.join(ws.root, 'public')])
		assert.match(await fs.readFile(path.join(ws.root, 'public/index.html'), 'utf8'), /visual-mode-edit/)
		ws.evidence.checks.push(
			'agent restart reconnects to same server',
			'safe shutdown reports stopped',
			'cms mode writes back to files',
			'preview serves actual rendered site',
			'mode switch preserves content',
			'static production build',
			'readable MCP logs'
		)
		await fs.writeFile('fresh-machine-result.json', JSON.stringify(ws.evidence, null, 2) + '\n')
		console.log(ws.evidence)
	} catch (error) {
		console.error('Native onboarding failure output: ' + dev?.output?.slice(-5000))
		throw error
	} finally {
		await stop(dev)
		if (mcp) await mcp.close()
		if (busy) await new Promise((resolve) => busy.close(resolve))
		await ws.cleanup()
	}
})
