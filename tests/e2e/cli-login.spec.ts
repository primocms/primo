import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { devAuth } from './helpers/server'
import { TEST_SERVER_URL } from './helpers/paths'

// The browser tests run against the actual CMS build; the optional companion
// CLI path adds a cross-repository handoff test without changing the pinned CLI.
test('browser sign-in preserves the approval request and grants a single-use handoff', async ({ page, request }) => {
	await devAuth(request)
	const pending = await (await request.post('/api/primo/cli-login/start')).json()
	await page.route('**/api/primo/dev-auth', (route) => route.fulfill({ status: 404, body: '{}' }))
	await page.goto(pending.verification_uri)
	await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
	await page.getByLabel('Email', { exact: true }).fill('dev@primo.local')
	await page.getByLabel('Password', { exact: true }).fill('devpassword123')
	await page.getByRole('button', { name: 'Sign in', exact: true }).click()
	await expect(page.getByRole('heading', { name: 'Connect Primo CLI?' })).toBeVisible()
	await expect(page.locator('code')).toHaveText(pending.user_code)
	await page.screenshot({ path: 'test-results/cli-login-approval.png' })
	await page.getByRole('button', { name: 'Allow access' }).click()
	await expect(page.getByRole('heading', { name: 'Primo CLI connected' })).toBeVisible()
	const granted = await request.post('/api/primo/cli-login/token', { data: { device_code: pending.device_code } })
	expect(granted.status()).toBe(200)
	const authorization = await granted.json()
	expect(authorization.record.email).toBe('dev@primo.local')
	const reused = await request.post('/api/collections/users/auth-refresh', { headers: { Authorization: authorization.token } })
	expect(reused.status()).toBe(200)
	const replay = await request.post('/api/primo/cli-login/token', { data: { device_code: pending.device_code } })
	expect(replay.status()).toBe(400)
	// The same browser session can approve the next request without signing in.
	const second = await (await request.post('/api/primo/cli-login/start')).json()
	await page.goto(second.verification_uri)
	await expect(page.getByRole('heading', { name: 'Connect Primo CLI?' })).toBeVisible()
	await page.getByRole('button', { name: 'Decline' }).click()
	await expect(page.getByRole('heading', { name: 'Request declined' })).toBeVisible()
	const denied = await request.post('/api/primo/cli-login/token', { data: { device_code: second.device_code } })
	expect(denied.status()).toBe(403)
})

test('an invalid approval link gives an actionable message', async ({ page }) => {
	await page.goto('/admin/cli-login?code=invalid')
	await expect(page.getByRole('heading', { name: 'Login request unavailable' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Allow access' })).toHaveCount(0)
})

test('companion CLI resumes after browser approval and reuses the saved login', async ({ page, request }) => {
	const entry = process.env.PRIMO_BROWSER_LOGIN_CLI
	test.skip(!entry, 'Set PRIMO_BROWSER_LOGIN_CLI to test the companion CLI checkout.')
	const auth = await devAuth(request)
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'primo-browser-login-'))
	const environment = { ...process.env, HOME: directory, USERPROFILE: directory }
	const child = spawn(process.execPath, [entry!, 'login', TEST_SERVER_URL, '--no-browser'], { env: environment })
	let output = ''
	child.stdout.on('data', (data) => {
		output += data
	})
	child.stderr.on('data', (data) => {
		output += data
	})
	const closed = once(child, 'close')
	try {
		await expect.poll(() => output, { timeout: 10000 }).toContain('/admin/cli-login?code=')
		const url = output.match(/http:\/\/[^\s]+\/admin\/cli-login\?code=[A-F0-9-]+/)?.[0]
		expect(url).toBeTruthy()
		await page.addInitScript((value) => localStorage.setItem('pocketbase_auth', JSON.stringify(value)), auth)
		await page.goto(url!)
		await expect(page.getByRole('heading', { name: 'Connect Primo CLI?' })).toBeVisible()
		await page.getByRole('button', { name: 'Allow access' }).click()
		await closed
		expect(child.exitCode, output).toBe(0)
		const tokens = JSON.parse(await fs.readFile(path.join(directory, '.primo/tokens.json'), 'utf8'))
		expect(tokens[TEST_SERVER_URL]).toBeTruthy()
		const again = spawn(process.execPath, [entry!, 'login', TEST_SERVER_URL, '--no-browser'], { env: environment })
		let reused = ''
		again.stdout.on('data', (data) => {
			reused += data
		})
		again.stderr.on('data', (data) => {
			reused += data
		})
		await once(again, 'close')
		expect(again.exitCode, reused).toBe(0)
		expect(reused).toContain('Already logged in')
		expect(reused).not.toContain('Approve access')
	} finally {
		if (child.exitCode === null) {
			child.kill('SIGKILL')
			await closed
		}
		await fs.rm(directory, { recursive: true, force: true })
	}
})
