import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite

/** Publishes via the real UI flow (dev-mode toolbar button is labeled
 * "Preview" but wires to the same usePublishSite -> Pages.update(compiled_html)
 * -> POST /api/primo/generate). A direct POST to /api/primo/generate
 * without first uploading compiled_html (what the client does) 404s inside
 * GenerateSite's copyIfChanged, because the page's compiled_html field is
 * still empty — that upload step only happens client-side, so exercising
 * the button is both the faithful path and the only one that actually
 * works, matching "exercise the real UI and backend... don't mock
 * publishing" from the task brief. */
async function publishViaUI(page: import('@playwright/test').Page) {
	const generateResponsePromise = page.waitForResponse(
		(res) => res.url().includes('/api/primo/generate') && res.request().method() === 'POST',
		{ timeout: 15000 }
	)
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
		await page.waitForResponse(
			(res) => res.url().includes('/api/collections/page_section_entries/records/') && res.request().method() === 'PATCH',
			{ timeout: 5000 }
		)

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
		await page.waitForResponse(
			(res) => res.url().includes('/api/collections/page_section_entries/records/') && res.request().method() === 'PATCH',
			{ timeout: 5000 }
		)

		await publishViaUI(page)

		const republishedRes = await request.get(`${TEST_SERVER_URL}/?_site=${ids.siteId}`)
		const html2 = await republishedRes.text()
		expect(html2).toContain(secondHeadline)
		expect(html2).not.toContain(firstHeadline)
	})
})
