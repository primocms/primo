import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const binary = process.env.PRIMO_TEST_CMS_BINARY
const cliEntry = process.env.PRIMO_TEST_CLI_ENTRY

test(
	'agent launch: create, preview, deploy, browser account authorization, publish, return verified links',
	{
		skip: !binary || !cliEntry,
		timeout: 180000
	},
	async (t) => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'primo-agent-launch-'))
		const home = path.join(root, 'home'),
			cwd = path.join(root, 'workspace')
		await fs.mkdir(home)
		await fs.mkdir(cwd)
		const children = []
		const browser = await chromium.launch({ headless: true })
		t.after(async () => {
			await browser.close()
			for (const child of children.reverse()) {
				if (child.exitCode === null && child.signalCode === null) {
					const done = once(child, 'close')
					child.kill('SIGTERM')
					await done
				}
			}
			await fs.rm(root, { recursive: true, force: true })
		})
		const env = { ...process.env, HOME: home, USERPROFILE: home, PRIMO_BINARY: binary, PRIMO_ENABLE_USAGE_STATS: 'false', NO_COLOR: '1' }
		async function cli(args, extraEnv = {}, expectedCode = 0) {
			const child = spawn(process.execPath, [cliEntry, ...args], { cwd, env: { ...env, ...extraEnv } })
			let stdout = '',
				stderr = ''
			child.stdout.on('data', (data) => (stdout += data))
			child.stderr.on('data', (data) => (stderr += data))
			const timer = setTimeout(() => child.kill('SIGKILL'), 45000)
			const [code] = await once(child, 'close')
			clearTimeout(timer)
			assert.equal(code, expectedCode, `${args.join(' ')} failed:\n${stdout}\n${stderr}`)
			return { stdout, stderr }
		}
		await cli(['init', '--no-mcp'])
		await cli(['new', 'landing', '--skip-dev'])
		const dev = spawn(process.execPath, [cliEntry, 'dev'], { cwd, env })
		children.push(dev)
		let devLogs = ''
		dev.stdout.on('data', (data) => (devLogs += data))
		dev.stderr.on('data', (data) => (devLogs += data))
		const syncFile = path.join(cwd, 'sites/landing/.primo/sync_status.json')
		let sync
		for (let i = 0; i < 150; i++) {
			try {
				sync = JSON.parse(await fs.readFile(syncFile, 'utf8'))
				if (sync.ok) break
			} catch {}
			if (dev.exitCode !== null) assert.fail(devLogs)
			await delay(100)
		}
		assert.equal(sync?.ok, true, devLogs)
		const runtime = JSON.parse(await fs.readFile(path.join(cwd, '.primo/dev-server.json'), 'utf8'))
		let running = false
		for (let i = 0; i < 100; i++) {
			try {
				const response = await fetch(`http://127.0.0.1:${runtime.port + 1}/__primo/runtime`)
				const identity = await response.json()
				if (response.ok && identity.instance === runtime.instance) {
					running = true
					break
				}
			} catch {}
			await delay(100)
		}
		assert.ok(running, devLogs)
		const preview = JSON.parse((await cli(['preview', '--dir', 'sites/landing', '--json'])).stdout)
		assert.equal(preview.ok, true, JSON.stringify(preview))
		const siteYaml = await fs.readFile(path.join(cwd, 'sites/landing/site.yaml'), 'utf8')
		const id = siteYaml.match(/^site_id: (.+)$/m)[1].trim()
		const local = await fetch(`http://127.0.0.1:${runtime.port}/?_site=${id}`)
		assert.equal(local.status, 200)
		const stopped = once(dev, 'close')
		dev.kill('SIGTERM')
		await stopped
		// Fresh CMS stands in for a newly provisioned cloud instance.
		const reservation = net.createServer()
		await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve))
		const port = reservation.address().port
		await new Promise((resolve) => reservation.close(resolve))
		const server = `http://127.0.0.1:${port}`
		const hosted = spawn(binary, ['serve', '--http', `127.0.0.1:${port}`, '--dir', path.join(root, 'hosted-data')], { env: { ...env, PRIMO_DEV_MODE: '0' } })
		children.push(hosted)
		let hostedLogs = ''
		hosted.stdout.on('data', (data) => (hostedLogs += data))
		hosted.stderr.on('data', (data) => (hostedLogs += data))
		let healthy = false
		for (let i = 0; i < 100; i++) {
			try {
				if ((await fetch(`${server}/api/health`)).ok) {
					healthy = true
					break
				}
			} catch {}
			if (hosted.exitCode !== null) assert.fail(hostedLogs)
			await delay(100)
		}
		assert.ok(healthy, hostedLogs)
		const bin = path.join(root, 'bin')
		await fs.mkdir(bin)
		await fs.writeFile(
			path.join(bin, 'railway'),
			`#!${process.execPath}\nconst args=process.argv.slice(2);if(args[0]==='status')console.log(JSON.stringify({id:'project-id',environments:{edges:[{node:{id:'env-id',name:'production'}}]},services:{edges:[{node:{id:'service-id',name:'workspace'}}]}}));else if(args[0]==='volume'&&args[1]==='list')console.log(JSON.stringify({volumes:[{mountPath:'/app/pb_data',serviceName:'workspace',status:'Ready'}]}));else if(args[0]==='up')console.log('{\"deploymentId\":\"test-deployment\"}');else if(args[0]==='deployment')console.log('[{\"id\":\"test-deployment\",\"status\":\"SUCCESS\"}]');else if(args[0]==='domain')console.log(JSON.stringify({url:process.env.INSTANCE_URL}));else console.log('ok');\n`,
			{ mode: 0o755 }
		)
		const deployed = JSON.parse((await cli(['deploy', '--provider', 'railway', '--no-domains', '--json'], { PATH: bin + path.delimiter + process.env.PATH, INSTANCE_URL: server }, 1)).stdout)
		assert.equal(deployed.provisioning, 'succeeded')
		assert.equal(deployed.upload, 'not_attempted')
		assert.equal(deployed.error_code, 'hosted_auth_required')
		assert.equal(deployed.publication, 'not_requested')
		assert.equal(deployed.cms_url, `${server}/admin/`)
		const start = JSON.parse((await cli(['login', '--browser', '--json'])).stdout)
		assert.equal(start.state, 'pending')
		const page = await browser.newPage()
		// Loopback deliberately bypasses hosted setup gating; open setup directly
		// with the same continuation that the hosted redirect supplies.
		const destination = new URL(start.authorization_url).pathname + new URL(start.authorization_url).search
		await page.goto(`${server}/admin/setup?next=${encodeURIComponent(destination)}`)
		await page.locator('[data-test-id=email]').fill('owner@example.com')
		await page.locator('[data-test-id=password]').fill('test-launch-password')
		await page.locator('[data-test-id=confirm-password]').fill('test-launch-password')
		await page.locator('[data-test-id=create-user]').click()
		await page.waitForURL('**/admin/cli-login?code=*')
		await page.getByRole('button', { name: 'Authorize CLI' }).click()
		await page.getByRole('heading', { name: 'Your agent is authorized' }).waitFor()
		const checked = JSON.parse((await cli(['login', '--check', '--json'])).stdout)
		assert.equal(checked.state, 'authenticated')
		const pushed = JSON.parse((await cli(['push', '--json'])).stdout)
		assert.equal(pushed.ok, true, JSON.stringify(pushed))
		assert.ok(pushed.results.some((result) => result.target === 'library' && result.push.state === 'succeeded'))
		const attached = JSON.parse((await cli(['domain', 'attach', 'launch.example.test', '--only', 'landing', '--json'])).stdout)
		assert.equal(attached.status, 'pending')
		assert.equal(attached.site_url, 'https://launch.example.test')
		const published = JSON.parse((await cli(['publish', '--only', 'landing', '--json'])).stdout)
		assert.equal(published.ok, true, JSON.stringify(published))
		const status = JSON.parse((await cli(['status', '--hosted', '--only', 'landing', '--json'])).stdout)
		assert.equal(status.results[0].publication.state, 'current')
		assert.equal(status.results[0].cms_url, `${server}/admin/`)
		const siteURL = status.results[0].site_url
		assert.ok(siteURL)
		// Model DNS/proxy routing with a Host header against the disposable listener.
		// This verifies Primo's public routing; real DNS and TLS are not provisioned.
		const website = await new Promise((resolve, reject) => {
			http
				.get(server, { headers: { Host: new URL(siteURL).host } }, (response) => {
					let html = ''
					response.on('data', (data) => (html += data))
					response.on('end', () => resolve({ status: response.statusCode, html }))
				})
				.on('error', reject)
		})
		assert.equal(website.status, 200)
		assert.match(website.html, /Welcome to your new site|Welcome|hero/i)
		const tokens = JSON.parse(await fs.readFile(path.join(home, '.primo/tokens.json'), 'utf8'))
		const confirmed = await fetch(`${server}/api/primo/sites/${status.results[0].site_id}/domain/mark-live`, { method: 'POST', headers: { Authorization: `Bearer ${tokens[server]}` } })
		assert.equal(confirmed.status, 200)
		const domainStatus = JSON.parse((await cli(['domain', 'status', '--only', 'landing', '--json'])).stdout)
		assert.equal(domainStatus.provider_status, 'live')
		assert.equal(domainStatus.live, false)
		assert.equal(domainStatus.status, 'verifying')
		const image = path.join(root, 'authorization.png')
		await page.screenshot({ path: image, fullPage: true })
		if (process.env.PRIMO_TEST_SCREENSHOT) await fs.copyFile(image, process.env.PRIMO_TEST_SCREENSHOT)
	}
)
