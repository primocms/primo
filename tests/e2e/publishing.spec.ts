import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite

/** Exercise the real compiler and tracked publication flow. The dev-mode
 * toolbar calls it "Preview"; it still uploads compiled artifacts and waits
 * for the atomic activation endpoint before serving the new output. */
async function publishViaUI(page: import('@playwright/test').Page) {
	const generateResponsePromise = page.waitForResponse((res) => res.url().includes('/api/primo/publication/') && res.url().endsWith('/activate') && res.request().method() === 'POST', {
		timeout: 15000
	})
	await page.getByRole('button', { name: 'Preview' }).click()
	const dialog = page.getByRole('dialog')
	const confirmButton = dialog.getByRole('button', { name: /publish|preview|confirm/i }).first()
	if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
		await confirmButton.click()
	}
	const res = await generateResponsePromise
	expect(res.ok()).toBeTruthy()
	await page.waitForTimeout(300)
}

test.describe('Publishing', () => {
	test.beforeAll(async ({ request }) => {
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'Publishing Fixture')
	})

	test('published output contains edits, and updates again after a second edit + republish', async ({ page, request }) => {
		await loginAsDeveloper(page, ids.siteId)

		const frame = canvasFrame(page)
		const headline = frame.locator('[data-testid="headline"]')
		await expect(headline).toBeVisible({ timeout: 15000 })

		// --- 3a: edit and publish ---
		const firstHeadline = `Published Headline ${Date.now()}`
		await replaceContentEditableText(page, headline, firstHeadline)
		await headline.blur()
		await page.waitForResponse((res) => res.url().includes('/api/collections/page_section_entries/records/') && res.request().method() === 'PATCH', { timeout: 5000 })

		await publishViaUI(page)

		// The published/served page is the same Go server's catch-all site
		// route (internal/serve.go), reached here via ?_site=<id> since in
		// dev mode a bare "/" on localhost redirects to the admin dashboard
		// instead of serving the site (serve.go's DevMode bare-localhost
		// guard) — ?_site is the same param the editor's own live-preview
		// iframe uses.
		const publishedRes = await request.get(`${TEST_SERVER_URL}/?_site=${ids.siteId}`)
		expect(publishedRes.ok()).toBeTruthy()
		const html = await publishedRes.text()
		expect(html).toContain(firstHeadline)

		// --- 3b: make another change, republish, verify update ---
		await page.reload()
		const frame2 = canvasFrame(page)
		const headline2 = frame2.locator('[data-testid="headline"]')
		await expect(headline2).toBeVisible({ timeout: 15000 })

		const secondHeadline = `Republished Headline ${Date.now()}`
		await replaceContentEditableText(page, headline2, secondHeadline)
		await headline2.blur()
		await page.waitForResponse((res) => res.url().includes('/api/collections/page_section_entries/records/') && res.request().method() === 'PATCH', { timeout: 5000 })

		await publishViaUI(page)

		const republishedRes = await request.get(`${TEST_SERVER_URL}/?_site=${ids.siteId}`)
		const html2 = await republishedRes.text()
		expect(html2).toContain(secondHeadline)
		expect(html2).not.toContain(firstHeadline)
	})

	// A just-created page has no sections. Page generation used to report that
	// as a failure with no error ("Unknown error"), which aborted publishing for
	// the whole site until the page got a section: the client never reached
	// the activation endpoint, so publishViaUI's wait for it times out.
	test('a site with an empty new page still publishes', async ({ page, request }) => {
		const { token } = await devAuth(request)
		const headers = { Authorization: `Bearer ${token}` }
		const typesRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
			headers,
			params: { filter: `site = "${ids.siteId}"` }
		})
		const pageType = (await typesRes.json()).items[0]
		expect(pageType).toBeTruthy()
		const created = await request.post(`${TEST_SERVER_URL}/api/collections/pages/records`, {
			headers,
			data: { name: 'Empty Page', slug: `empty-${Date.now()}`, page_type: pageType.id, site: ids.siteId }
		})
		expect(created.ok()).toBeTruthy()

		await loginAsDeveloper(page, ids.siteId)
		await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible({ timeout: 15000 })
		await publishViaUI(page)

		// publishViaUI asserted activation succeeded; the site stays served.
		const homeRes = await request.get(`${TEST_SERVER_URL}/?_site=${ids.siteId}`)
		expect(homeRes.ok()).toBeTruthy()
	})
})
