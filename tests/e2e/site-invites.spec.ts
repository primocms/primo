import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'
import { loginAs, loginAsDeveloperAtDashboard } from './helpers/editor'

test('an existing collaborator invited to another site gets a simple grid of assigned sites', async ({ page, browser, request }) => {
	test.setTimeout(90000)
	const { token } = await devAuth(request)
	const headers = { Authorization: `Bearer ${token}` }
	const first = await seedFixtureSite(token, 'First shared site')
	// Keep this identity isolated from the editor account shared by other specs.
	const editor = { email: 'existing-site-invite@primo.local', password: 'existinginvitepassword123', userId: '' }
	const userRes = await request.post(`${TEST_SERVER_URL}/api/collections/users/records`, {
		headers,
		data: { email: editor.email, password: editor.password, passwordConfirm: editor.password }
	})
	expect(userRes.ok()).toBeTruthy()
	editor.userId = (await userRes.json()).id
	const firstAssignment = await request.post(`${TEST_SERVER_URL}/api/collections/site_role_assignments/records`, {
		headers,
		data: { site: first.siteId, user: editor.userId, role: 'editor' }
	})
	expect(firstAssignment.ok()).toBeTruthy()
	const groupRes = await request.post(`${TEST_SERVER_URL}/api/collections/site_groups/records`, { headers, data: { name: 'Another group', index: 1 } })
	expect(groupRes.ok()).toBeTruthy()
	const group = await groupRes.json()
	const secondRes = await request.post(`${TEST_SERVER_URL}/api/collections/sites/records`, { headers, data: { name: 'Second shared site', host: 'second-shared.example', group: group.id } })
	expect(secondRes.ok()).toBeTruthy()
	const second = await secondRes.json()
	const privateRes = await request.post(`${TEST_SERVER_URL}/api/collections/sites/records`, { headers, data: { name: 'Private site', host: 'private.example', group: group.id } })
	expect(privateRes.ok()).toBeTruthy()

	await loginAsDeveloperAtDashboard(page)
	await page.goto(`/admin/dashboard/sites?group=${group.id}`)
	await page.getByRole('button', { name: 'Options for Second shared site', exact: true }).click()
	await page.getByRole('menuitem', { name: 'Collaborators', exact: true }).click()
	await expect(page.locator(`#site-invite-accounts option[value="${editor.email}"]`)).toHaveCount(1)
	const createdUsers: string[] = []
	page.on('request', (req) => {
		if (req.method() === 'POST' && req.url().endsWith('/api/collections/users/records')) createdUsers.push(req.url())
	})
	await page.getByPlaceholder('Email address').fill(editor.email.toUpperCase())
	await page.locator('.Invitation select').selectOption('editor')
	await page.getByRole('button', { name: 'Generate link', exact: true }).click()
	const link = page.locator('pre.link')
	await expect(link).toHaveText(`${TEST_SERVER_URL}/admin/dashboard/sites`)
	await expect(page.getByRole('alertdialog')).toBeVisible()
	const assignmentsRes = await request.get(`${TEST_SERVER_URL}/api/collections/site_role_assignments/records`, { headers, params: { filter: `site = "${second.id}" && user = "${editor.userId}"` } })
	expect(assignmentsRes.ok()).toBeTruthy()
	expect((await assignmentsRes.json()).items).toHaveLength(1)
	expect(createdUsers).toHaveLength(0)
	await page.screenshot({ path: '/tmp/site-invites-admin.png' })

	const context = await browser.newContext()
	try {
		const collaboratorPage = await context.newPage()
		await loginAs(collaboratorPage, editor.email, editor.password, first.siteId)
		await expect(collaboratorPage.getByRole('link', { name: 'Sites', exact: true })).toBeVisible()
		await collaboratorPage.getByRole('link', { name: 'Sites', exact: true }).click()
		await expect(collaboratorPage).toHaveURL(/\/admin\/dashboard\/sites$/)
		await expect(collaboratorPage.locator('.site-card')).toHaveCount(2)
		await expect(collaboratorPage.getByRole('link', { name: 'Second shared site', exact: true })).toBeVisible()
		await expect(collaboratorPage.getByRole('link', { name: /^First shared site/ })).toBeVisible()
		await expect(collaboratorPage.getByText('Private site', { exact: true })).toHaveCount(0)
		await expect(collaboratorPage.locator('[data-sidebar="sidebar"]')).toHaveCount(0)
		await expect(collaboratorPage.getByRole('button', { name: /Create Site|Group options|Options for|Toggle Sidebar/ })).toHaveCount(0)
		await expect(collaboratorPage.getByRole('button', { name: 'Log out' })).toBeVisible()
		await expect(collaboratorPage.locator('.sites-list')).toHaveCSS('opacity', '1')
		await collaboratorPage.screenshot({ path: '/tmp/site-invites-collaborator.png' })

		// Group links from older editor sessions must still show every shared site.
		await collaboratorPage.goto(`/admin/dashboard/sites?group=${group.id}`)
		await expect(collaboratorPage.locator('.site-card')).toHaveCount(2)
		// Direct navigation cannot expose server tools in the sidebar-free shell.
		await collaboratorPage.goto('/admin/dashboard/library')
		await expect(collaboratorPage).toHaveURL(/\/admin\/dashboard\/sites$/)
		await expect(collaboratorPage.locator('.site-card')).toHaveCount(2)
		// Both an ordinary admin entry and an existing session at sign-in land here.
		for (const path of ['/admin', '/admin/auth']) {
			await collaboratorPage.goto(path)
			await expect(collaboratorPage).toHaveURL(/\/admin\/dashboard\/sites$/)
			await expect(collaboratorPage.locator('.site-card')).toHaveCount(2)
		}
	} finally {
		await context.close()
	}

	const signedOutContext = await browser.newContext()
	try {
		const signInPage = await signedOutContext.newPage()
		// Disable localhost auto-auth to exercise the actual password sign-in UI.
		await signInPage.route('**/api/primo/dev-auth', (route) => route.fulfill({ status: 403, body: '{}' }))
		await signInPage.goto('/admin/auth')
		await signInPage.getByLabel('Email', { exact: true }).fill(editor.email)
		await signInPage.getByLabel('Password', { exact: true }).fill(editor.password)
		await signInPage.getByRole('button', { name: 'Sign in', exact: true }).click()
		await expect(signInPage).toHaveURL(/\/admin\/dashboard\/sites$/)
		await expect(signInPage.locator('.site-card')).toHaveCount(2)
		await signInPage.getByRole('button', { name: 'Log out', exact: true }).click()
		await expect(signInPage.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
	} finally {
		await signedOutContext.close()
	}
})
