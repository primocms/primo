import { test, expect } from '@playwright/test'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'
import { loginAsDeveloper, loginAsDeveloperAtDashboard, stubExternalImages } from './helpers/editor'

// Exercise UI state without sending real password-reset emails or changing credentials.
async function signedOut(page) {
	await page.route('**/api/primo/dev-auth', (route) => route.fulfill({ status: 404, body: '{}' }))
}

test.describe('Auth forms', () => {
	test.beforeEach(async ({ page }) => {
		await signedOut(page)
	})

	test('sign-in shows a password toggle, prevents duplicate submissions, and recovers from errors', async ({ page }) => {
		let release: () => void = () => {}
		const submitted = new Promise<void>((resolve) => {
			release = resolve
		})
		let submissions = 0
		await page.route('**/api/collections/users/auth-with-password', async (route) => {
			submissions++
			await submitted
			await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Email or password is incorrect.' }) })
		})
		await page.goto('/admin/auth')
		await page.getByLabel('Email', { exact: true }).fill('ui-test@example.com')
		const password = page.getByLabel('Password', { exact: true })
		await password.fill('example-password')
		await page.getByRole('button', { name: 'Show password', exact: true }).click()
		await expect(password).toHaveAttribute('type', 'text')
		await page.getByRole('button', { name: 'Hide password', exact: true }).click()
		await expect(password).toHaveAttribute('type', 'password')
		await page.getByRole('button', { name: 'Sign in', exact: true }).click()
		await expect(page.getByRole('button', { name: 'Please wait…' })).toBeDisabled()
		await expect.poll(() => submissions).toBe(1)
		release()
		await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')
		await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
	})

	test('reset confirmation keeps the email and provides a path back to sign-in', async ({ page }) => {
		await page.route('**/api/collections/users/request-password-reset', (route) => route.fulfill({ status: 204 }))
		await page.goto('/admin/auth')
		await page.getByLabel('Email', { exact: true }).fill('ui-test@example.com')
		await page.getByRole('button', { name: 'Forgot your password?' }).click()
		await expect(page.getByLabel('Email', { exact: true })).toHaveValue('ui-test@example.com')
		await page.getByRole('button', { name: 'Send reset link' }).click()
		await expect(page.getByRole('status')).toContainText('ui-test@example.com')
		await expect(page.getByRole('button', { name: 'Send reset link' })).toHaveCount(0)
		await page.getByRole('button', { name: 'Back to sign in' }).click()
		await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
		await expect(page.getByLabel('Email', { exact: true })).toHaveValue('ui-test@example.com')
	})

	test('new passwords are validated locally and invitation forms fit narrow screens', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 740 })
		let submissions = 0
		await page.route('**/api/collections/users/confirm-password-reset', (route) => {
			submissions++
			return route.fulfill({ status: 400, body: '{}' })
		})
		await page.goto('/admin/auth?create=ui-test-token&email=ui-test%40example.com')
		await expect(page.getByLabel('Email', { exact: true })).toHaveValue('ui-test@example.com')
		await page.getByLabel('Password', { exact: true }).fill('first-password')
		await page.getByLabel('Confirm password', { exact: true }).fill('second-password')
		await page.getByRole('button', { name: 'Create account', exact: true }).click()
		await expect(page.getByRole('alert')).toContainText('Passwords do not match')
		expect(submissions).toBe(0)
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
	})
})

test.describe('Editor dialogs', () => {
	let ids: SeededSite
	test.beforeAll(async ({ request }) => {
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'UI polish')
	})

	test('page action menus work with the keyboard and return focus after Escape', async ({ page }) => {
		await stubExternalImages(page)
		await loginAsDeveloper(page, ids.siteId)
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		const trigger = page.getByRole('button', { name: 'Options for Home', exact: true })
		await trigger.focus()
		await trigger.press('ArrowDown')
		await expect(page.getByRole('menu')).toBeVisible()
		await page.getByRole('menu').press('Escape')
		await expect(page.getByRole('menu')).toBeHidden()
		await expect(trigger).toBeFocused()
		await expect(page.getByRole('dialog', { name: /^Pages/ })).toBeVisible()
	})

	test('create page has an explicit action and its fields fit a narrow dialog', async ({ page }) => {
		await stubExternalImages(page)
		await loginAsDeveloper(page, ids.siteId)
		await page.setViewportSize({ width: 390, height: 844 })
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		await page.getByRole('button', { name: 'Create page', exact: true }).click()
		const action = page.getByRole('button', { name: 'Create page', exact: true })
		await expect(action).toBeDisabled()
		await page.getByLabel('Page name', { exact: true }).fill('UI review page')
		await expect(page.getByLabel('Page slug', { exact: true })).toHaveValue('ui-review-page')
		await expect(action).toBeEnabled()
		const dialog = page.getByRole('dialog', { name: /^Pages/ })
		expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
		await action.click()
		await expect(dialog.getByRole('link', { name: 'UI review page', exact: true })).toBeVisible()
	})

	test('page creation retains values on duplicate slugs and server failures, then retries', async ({ page, request }) => {
		const { token } = await devAuth(request)
		const headers = { Authorization: `Bearer ${token}` }
		const homepage = await (await request.get(`/api/collections/pages/records/${ids.pageId}`, { headers })).json()
		const existing = await request.post('/api/collections/pages/records', {
			headers,
			data: { name: 'Duplicate fixture', slug: 'duplicate-fixture', parent: ids.pageId, site: ids.siteId, page_type: homepage.page_type, index: 99 }
		})
		expect(existing.ok()).toBeTruthy()
		await loginAsDeveloper(page, ids.siteId)
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		const dialog = page.getByRole('dialog', { name: /^Pages/ })
		await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
		await page.getByLabel('Page name', { exact: true }).fill('Duplicate fixture')
		await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
		await expect(dialog.getByRole('alert')).toHaveText('That URL is already in use')
		await expect(page.getByLabel('Page name', { exact: true })).toHaveValue('Duplicate fixture')
		await page.getByLabel('Page name', { exact: true }).fill('Retry creation')
		const target = '**/api/collections/pages/records'
		await page.route(target, (route) =>
			route.request().method() === 'POST' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Page creation was rejected.' }) }) : route.continue()
		)
		await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
		await expect(dialog.getByRole('alert')).toContainText('Page creation was rejected')
		await expect(page.getByLabel('Page name', { exact: true })).toHaveValue('Retry creation')
		await page.unroute(target)
		await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
		await expect(dialog.getByRole('link', { name: 'Retry creation', exact: true })).toBeVisible()
		await expect(page.getByLabel('Page name', { exact: true })).toHaveCount(0)
		await page.reload()
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		await expect(page.getByRole('dialog').getByRole('link', { name: 'Retry creation', exact: true })).toBeVisible()
	})

	test('rename keeps the dialog open on failure, blocks duplicate saves, and persists a retry', async ({ page, request }) => {
		const { token } = await devAuth(request)
		const headers = { Authorization: `Bearer ${token}` }
		const record = await (await request.get(`/api/collections/sites/records/${ids.siteId}`, { headers })).json()
		await loginAsDeveloperAtDashboard(page)
		await page.getByRole('button', { name: `Options for ${record.name}`, exact: true }).click()
		await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
		const dialog = page.getByRole('dialog', { name: 'Rename site', exact: true })
		await dialog.getByRole('textbox').fill('Renamed UI fixture')
		let release: () => void = () => {}
		const paused = new Promise<void>((resolve) => {
			release = resolve
		})
		let attempts = 0
		const target = `**/api/collections/sites/records/${ids.siteId}`
		await page.route(target, async (route) => {
			if (route.request().method() !== 'PATCH') return route.continue()
			attempts++
			await paused
			await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Could not save this name.' }) })
		})
		await dialog.getByRole('button', { name: 'Rename', exact: true }).click()
		await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
		await expect.poll(() => attempts).toBe(1)
		release()
		await expect(dialog.getByRole('alert')).toHaveText('Could not save this name.')
		await expect(dialog).toBeVisible()
		await page.unroute(target)
		await dialog.getByRole('button', { name: 'Rename', exact: true }).click()
		await expect(dialog).toBeHidden()
		const updated = await (await request.get(`/api/collections/sites/records/${ids.siteId}`, { headers })).json()
		expect(updated.name).toBe('Renamed UI fixture')
	})
})
