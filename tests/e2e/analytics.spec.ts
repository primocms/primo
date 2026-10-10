import { test, expect } from '@playwright/test'
import { gunzipSync } from 'node:zlib'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText } from './helpers/editor'

// PostHog filters automation traffic. Simulate an ordinary browser while
// intercepting every PostHog request so these checks never affect live metrics.
test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' })
let ids: SeededSite

test.beforeAll(async ({ request }) => {
	const { token } = await devAuth(request)
	ids = await seedFixtureSite(token, 'Analytics fixture')
})

for (const [label, enabled, dev] of [
	['enabled', true, false],
	['opted out', false, false],
	['development', true, true]
] as const) {
	test(`product analytics: ${label}`, async ({ page, request }) => {
		const events: any[] = []
		let analyticsRequests = 0
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
			analyticsRequests++
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
				headers: { 'access-control-allow-origin': 'http://127.0.0.1:8095', 'access-control-allow-credentials': 'true' },
				body: JSON.stringify({ status: 1, featureFlags: {}, featureFlagPayloads: {} })
			})
		})
		await loginAsDeveloper(page, ids.siteId)
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
			expect(analyticsRequests).toBe(0)
		}
	})
}
