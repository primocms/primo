import { test, expect, type Page } from '@playwright/test'
import { gunzipSync } from 'node:zlib'
import { devAuth, ensureEditorUser } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { TEST_SERVER_URL } from './helpers/paths'

// PostHog filters automation traffic. Simulate an ordinary browser while
// intercepting every PostHog request so these checks never affect live metrics.
test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' })
let ids: SeededSite
let editor: Awaited<ReturnType<typeof ensureEditorUser>>

test.beforeAll(async ({ request }) => {
	const { token } = await devAuth(request)
	ids = await seedFixtureSite(token, 'Analytics fixture')
	editor = await ensureEditorUser(request, token, ids.siteId)
})

async function captureAnalytics(page: Page, enabled: boolean, dev: boolean) {
	const events: any[] = []
	const captured = { events, analyticsRequests: 0 }
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'webdriver', { get: () => false })
		Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '130' }], mobile: false, platform: 'macOS' }) })
	})
	// The isolated E2E server always runs in development mode. Exercise the
	// production and opt-out client paths by supplying their instance flags.
	await page.route('**/api/primo/info*', async (route) => {
		const response = await route.fetch()
		await route.fulfill({ response, json: { ...(await response.json()), telemetry_enabled: enabled, dev_mode: dev } })
	})
	await page.route(/https:\/\/[^/]*posthog\.com\//, async (route) => {
		captured.analyticsRequests++
		const req = route.request()
		const raw = req.postDataBuffer()
		if (raw && /\/e\/|\/capture|\/batch/.test(req.url())) {
			let data = raw[0] === 31 && raw[1] === 139 ? gunzipSync(raw).toString() : raw.toString()
			if (data.startsWith('data=')) data = Buffer.from(new URLSearchParams(data).get('data') || '', 'base64').toString()
			const parsed = JSON.parse(data)
			events.push(...(Array.isArray(parsed) ? parsed : parsed.batch || [parsed]))
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': TEST_SERVER_URL, 'access-control-allow-credentials': 'true' },
			body: JSON.stringify({ status: 1, featureFlags: {}, featureFlagPayloads: {} })
		})
	})
	return captured
}

for (const [label, enabled, dev] of [
	['enabled', true, false],
	['opted out', false, false],
	['development', true, true]
] as const) {
	test(`product analytics: ${label}`, async ({ page, request }) => {
		const captured = await captureAnalytics(page, enabled, dev)
		const { events } = captured
		await loginAsDeveloper(page, ids.siteId)
		if (enabled && !dev) {
			await expect.poll(() => events.map((event) => event.event), { timeout: 15000 }).toContain('cms_opened')
			expect(events.filter((event) => event.event === 'cms_opened')).toHaveLength(1)
			expect(events.some((event) => event.event === 'login_succeeded')).toBe(false)
		}
		const headline = canvasFrame(page).locator('[data-testid="headline"]')
		await expect(headline).toHaveAttribute('contenteditable', 'true')
		const value = `Saved content that must not enter analytics: ${label}`
		await replaceContentEditableText(page, headline, value)
		await headline.blur()
		const { token } = await devAuth(request)
		await expect
			.poll(async () => {
				const response = await request.get('/api/collections/page_section_entries/records', {
					headers: { Authorization: `Bearer ${token}` },
					params: { filter: `section = "${ids.sectionId}" && field = "${ids.fieldIds.headline}"` }
				})
				return (await response.json()).items[0].value
			})
			.toBe(value)
		if (enabled && !dev) {
			await expect.poll(() => events.map((event) => event.event), { timeout: 15000 }).toContain('content_saved')
			const event = events.find((event) => event.event === 'content_saved')
			expect(event.properties.instance_id).toBeTruthy()
			expect(event.properties).not.toHaveProperty('email')
			expect(JSON.stringify(events)).not.toContain(value)
		} else {
			// Allow the SDK's usual batch interval to elapse before asserting silence.
			await page.waitForTimeout(4000)
			expect(captured.analyticsRequests).toBe(0)
		}
	})
	test(`CMS activity without edits: ${label}`, async ({ page }) => {
		test.setTimeout(60000)
		const captured = await captureAnalytics(page, enabled, dev)
		const { events } = captured
		// Keep the real password form visible on the isolated localhost server.
		await page.route('**/api/primo/dev-auth', (route) => route.fulfill({ status: 403, body: '{}' }))
		await page.goto(`/admin/auth?next=${encodeURIComponent(`/admin/sites/${ids.siteId}`)}&analytics_check=private-login-query#private-login-fragment`)
		await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
		await page.waitForTimeout(4000)
		expect(events).toHaveLength(0) // Anonymous sign-in visits aren't active editors.

		await page.getByLabel('Email', { exact: true }).fill(editor.email)
		await page.getByLabel('Password', { exact: true }).fill('wrong-password')
		await page.getByRole('button', { name: 'Sign in', exact: true }).click()
		await expect(page.getByRole('alert')).toBeVisible()
		await page.waitForTimeout(4000)
		expect(events).toHaveLength(0) // Failed authentication doesn't count as a login.

		await page.getByLabel('Password', { exact: true }).fill(editor.password)
		await page.getByRole('button', { name: 'Sign in', exact: true }).click()
		await expect(page).toHaveURL(new RegExp(`/admin/sites/${ids.siteId}`))
		await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible()
		if (enabled && !dev) {
			await expect.poll(() => events.map((event) => event.event), { timeout: 15000 }).toEqual(expect.arrayContaining(['cms_opened', 'login_succeeded']))
			for (const name of ['cms_opened', 'login_succeeded']) {
				const matching = events.filter((event) => event.event === name)
				expect(matching).toHaveLength(1)
				expect(matching[0].properties.distinct_id).toBe(editor.userId)
				expect(matching[0].properties.instance_id).toBeTruthy()
				expect(matching[0].properties).not.toHaveProperty('email')
			}
			expect(JSON.stringify(events)).not.toContain(editor.email)
			expect(JSON.stringify(events)).not.toContain(editor.password)
			expect(JSON.stringify(events)).not.toContain('private-login-query')
			expect(JSON.stringify(events)).not.toContain('private-login-fragment')
			expect(JSON.stringify(events)).not.toContain('/admin/')
			expect(events.some((event) => event.event === 'content_saved')).toBe(false)
		}

		// Moving between authenticated layouts shouldn't count another CMS open.
		await page.getByRole('link', { name: 'Sites', exact: true }).click()
		await expect(page).toHaveURL(/\/admin\/dashboard\/sites/)
		await expect(page.getByText(/^Analytics fixture /).first()).toBeVisible()
		await page.waitForTimeout(4000)
		if (enabled && !dev) {
			expect(events.filter((event) => event.event === 'cms_opened')).toHaveLength(1)
			// Reopening with a saved session counts activity, without a new login.
			await page.reload()
			await expect.poll(() => events.filter((event) => event.event === 'cms_opened').length, { timeout: 15000 }).toBe(2)
			expect(events.filter((event) => event.event === 'login_succeeded')).toHaveLength(1)
			expect(events.filter((event) => event.event === 'cms_opened')[1].properties.is_return_activity).toBe(false)
		} else {
			expect(captured.analyticsRequests).toBe(0)
		}
	})
}
