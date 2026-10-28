import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, firefox, webkit, expect } from '@playwright/test'
import { fixture } from '../presence/fixture.mjs'
import { submitPassword } from '../presence/auth-window.mjs'
import { agentSetupPlan } from '../../src/lib/agent-setup.js'
import { freshInstall, stop, until, call } from './fresh-install.mjs'
const engine = process.env.PRIMO_BROWSER || 'chromium'
// Browser login permits plain HTTP only on literal loopback. This process owns
// the disposable origin; production auth and authorization remain enabled.
process.env.PRIMO_PRESENCE_HOST = '127.0.0.1'
test(engine + ' agent handoff: empty profile, declined consent, browser approval, scoped pull and local preview', { timeout: 420000 }, async (t) => {
	const c = await fixture(t),
		ws = await freshInstall()
	let browser, login, dev, mcp
	const report = {
		...ws.evidence,
		productionMode: true,
		browser: engine,
		status: 'FAIL',
		manualTerminalSteps: 0,
		userActions: ['choose folder and approve installation', 'browser password sign-in', 'decline or allow access'],
		realUserData: false,
		hostedContentChanged: false
	}
	try {
		browser = await { chromium, firefox, webkit }[engine].launch({ headless: true })
		report.browserVersion = browser.version()
		const page = await browser.newPage()
		page.setDefaultTimeout(20000)
		const errors = []
		page.on('pageerror', (error) => errors.push(c.redact(error.message)))
		const plan = agentSetupPlan(c.origin)
		const tokens = path.join(ws.home, '.primo/tokens.json')
		const approval = async () => {
			login = ws.start(plan.login)
			await until(() => !!login.output.match(/http:\/\/127\.0\.0\.1:\d+\/admin\/cli-login\?code=[A-F0-9-]+/), 'CLI did not return a browser approval URL', 15000)
			return login.output.match(/http:\/\/127\.0\.0\.1:\d+\/admin\/cli-login\?code=[A-F0-9-]+/)[0]
		}
		const first = await approval()
		await page.goto(first)
		await c.waitForAuthWindow()
		await submitPassword(page, c.actors.builder)
		await expect(page.getByRole('heading', { name: 'Connect Primo CLI?' })).toBeVisible()
		await expect(page.locator('code')).toHaveText(new URL(first).searchParams.get('code'))
		await page.getByRole('button', { name: 'Decline', exact: true }).click()
		await expect(page.getByRole('heading', { name: 'Request declined' })).toBeVisible()
		await until(() => login.exitCode !== null, 'declined login remained pending', 15000)
		assert.notEqual(login.exitCode, 0)
		assert.equal(
			await fs.access(tokens).then(
				() => true,
				() => false
			),
			false,
			'decline must not save credentials'
		)
		const second = await approval()
		assert.notEqual(second, first)
		await page.goto(second)
		await expect(page.getByRole('heading', { name: 'Connect Primo CLI?' })).toBeVisible()
		await page.getByRole('button', { name: 'Allow access', exact: true }).click()
		await expect(page.getByRole('heading', { name: 'Primo CLI connected' })).toBeVisible()
		await until(() => login.exitCode !== null, 'approved login did not resume', 15000)
		assert.equal(login.exitCode, 0, c.redact(login.output))
		const saved = JSON.parse(await fs.readFile(tokens, 'utf8'))
		assert.ok(saved[c.origin])
		const reused = await ws.run(plan.login)
		assert.match(reused.stdout, /Already logged in/)
		assert.doesNotMatch(reused.stdout, /cli-login\?code=/)
		const pull = plan.pull.map((value) => (value === '<chosen-empty-folder>' ? ws.work : value))
		await ws.run(pull)
		const slugs = await fs.readdir(path.join(ws.work, 'sites'))
		assert.equal(slugs.length, 1, 'foreign site must not be exported')
		const site = path.join(ws.work, 'sites', slugs[0]),
			config = await fs.readFile(path.join(site, 'site.yaml'), 'utf8')
		assert.match(config, new RegExp(c.site.id))
		assert.doesNotMatch(config, new RegExp(c.foreign.id))
		await ws.run(['mcp', 'install', '--client', 'cursor', '--project', '--json'])
		const launch = JSON.parse(await fs.readFile(path.join(ws.work, '.cursor/mcp.json'), 'utf8')).mcpServers.primo
		mcp = await ws.connect(launch)
		await call(mcp, 'list_docs')
		const stopped = JSON.parse((await ws.run(plan.status)).stdout)
		assert.equal(stopped.running, false)
		dev = ws.start(plan.dev)
		let state
		await until(async () => {
			assert.equal(dev.exitCode, null, c.redact(dev.output))
			state = JSON.parse((await ws.run(plan.status)).stdout)
			return state.running && state.sites.length === 1 && state.sites.every((s) => s.in_cms && s.sync?.ok)
		}, 'pulled workspace did not import successfully')
		const local = `http://127.0.0.1:${state.port}`
		assert.equal(path.resolve(state.workspace), path.resolve(ws.work))
		assert.equal(state.sites[0].site_id, c.site.id)
		assert.equal((await fetch(local + '/api/primo/info').then((r) => r.json())).version, plan.cms)
		await call(mcp, 'get_dev_status', { site_path: site })
		await call(mcp, 'get_dev_logs', { site_path: site })
		await page.goto(local + '/admin')
		await page.waitForURL('**/admin/sites/' + c.site.id)
		await expect(page.locator('main iframe[title=block]').first().contentFrame().locator('h1')).toBeVisible()
		await ws.run(['preview', '--dir', site])
		const preview = await fetch(local + '/?_site=' + c.site.id)
		assert.ok(preview.ok)
		assert.match(await preview.text(), /disposable-presence-qa/)
		await mcp.close()
		mcp = await ws.connect(launch)
		await call(mcp, 'get_dev_status', { site_path: site })
		assert.equal(JSON.parse((await ws.run(plan.status)).stdout).pid, state.pid, 'agent reconnect must reuse the original server')
		await stop(dev)
		assert.equal(JSON.parse((await ws.run(plan.status)).stdout).running, false)
		await c.verifyContent()
		assert.deepEqual(errors, [])
		Object.assign(report, {
			status: 'PASS',
			checks: [
				...report.checks,
				'real browser password login with no CLI token injection',
				'declined consent saves no token',
				'new request approved by browser resumes CLI',
				'saved login reused',
				'scoped pull excludes foreign site',
				'actual configured MCP list_docs/status/logs',
				'ready imported workspace identity',
				'local CMS opens with expected site',
				'actual local preview serves rendered site',
				'agent restart reuses server',
				'owned server shutdown reported',
				'hosted source unchanged'
			]
		})
	} finally {
		await fs.writeFile('onboarding-' + engine + '.json', JSON.stringify(report, null, 2) + '\n')
		if (browser) await browser.close()
		await stop(login)
		await stop(dev)
		if (mcp) await mcp.close()
		await ws.cleanup()
	}
	console.log(report)
})
