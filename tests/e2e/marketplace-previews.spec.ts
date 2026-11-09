import { test, expect, type Page, type Locator } from '@playwright/test'
import { loginAsDeveloperAtDashboard } from './helpers/editor'

const marketplace = 'https://main.marketplace.primo.page'
const liveSite = 'https://starter-preview.test'
const group = { id: 'previewgroup001', name: 'Featured', index: 0 }
const starter = { id: 'previewsite0001', name: 'Snapshot Starter', group: group.id, host: 'starter-preview.test', preview: 'index.html', head: '', foot: '', description: '', index: 0 }
const noPreview = { ...starter, id: 'previewsite0002', name: 'Missing Preview', preview: '', index: 1 }
const failedPreview = { ...starter, id: 'previewsite0003', name: 'Failed Preview', index: 2 }
const snapshot = `<!DOCTYPE html><html><head>
<base href="https://wrong-base.test/">
<meta http-equiv="refresh" content="0;url=https://unexpected-navigation.test/">
<style>h1 { color: rgb(123, 45, 67); }</style>
<script>window.previewScriptRan = true; parent.previewScriptRan = true;</script>
</head><body><h1>Stored starter preview</h1><img src="/preview-image.svg" alt="Starter artwork" onload="window.previewScriptRan = true">
<iframe src="https://unexpected-frame.test/"></iframe>
</body></html>`

async function mockMarketplace(page: Page) {
	const liveNavigations: string[] = []
	const credentialLeaks: string[] = []
	const activeRequests: string[] = []
	await page.route(/https:\/\/unexpected-/, route => {
		activeRequests.push(route.request().url())
		return route.fulfill({ body: 'Unexpected active resource' })
	})
	await page.route(`${marketplace}/api/**`, async route => {
		const request = route.request()
		const url = new URL(request.url())
		if (url.pathname.startsWith('/api/files/')) {
			if (request.headers().authorization || request.headers().cookie) credentialLeaks.push(request.url())
			return route.fulfill({
				status: url.pathname.includes(failedPreview.id) ? 404 : 200,
				contentType: 'text/html', body: snapshot,
				headers: { 'Access-Control-Allow-Origin': '*', 'Content-Security-Policy': "frame-ancestors 'self'" }
			})
		}
		const collection = url.pathname.split('/')[3]
		const items = collection === 'site_groups' ? [group] : collection === 'sites' ? [starter, noPreview, failedPreview] : []
		await route.fulfill({ json: { page: 1, perPage: 500, totalItems: items.length, totalPages: 1, items } })
	})
	await page.route(`${liveSite}/**`, route => {
		if (route.request().isNavigationRequest()) liveNavigations.push(route.request().url())
		return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="red"/></svg>', headers: { 'Content-Security-Policy': "frame-ancestors 'self'" } })
	})
	return { liveNavigations, credentialLeaks, activeRequests }
}

async function assertSafePreview(iframe: Locator) {
	await expect(iframe).toHaveAttribute('sandbox', '')
	await expect(iframe).not.toHaveAttribute('src')
	const frame = iframe.contentFrame()
	await expect(frame.getByRole('heading', { name: 'Stored starter preview' })).toHaveCSS('color', 'rgb(123, 45, 67)')
	await expect.poll(() => frame.getByAltText('Starter artwork').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(24)
	expect(await frame.locator('body').evaluate(() => {
		let parentBlocked = false
		try { void parent.document.body } catch { parentBlocked = true }
		return { parentBlocked, scriptRan: Boolean((window as any).previewScriptRan), image: document.querySelector('img')?.src }
	})).toEqual({ parentBlocked: true, scriptRan: false, image: `${liveSite}/preview-image.svg` })
}

test('Marketplace cards render isolated snapshots and keep live links and failure fallbacks', async ({ page }) => {
	const probes = await mockMarketplace(page)
	await loginAsDeveloperAtDashboard(page)
	await page.getByRole('button', { name: 'Marketplace', exact: true }).click()
	const card = page.getByRole('link', { name: 'Preview Snapshot Starter (opens in a new tab)' })
	await expect(card).toHaveAttribute('href', liveSite)
	await assertSafePreview(card.locator('iframe'))
	for (const name of [noPreview.name, failedPreview.name]) {
		const unavailable = page.getByRole('link', { name: `Preview ${name} (opens in a new tab)` })
		await expect(unavailable.getByRole('status')).toHaveText('Preview unavailable')
		await expect(unavailable.locator('iframe')).toHaveCount(0)
	}
	expect(probes.liveNavigations).toEqual([])
	expect(probes.credentialLeaks).toEqual([])
	expect(probes.activeRequests).toEqual([])
})

test('Create Site uses snapshots for both starter cards and the selected preview', async ({ page }) => {
	const probes = await mockMarketplace(page)
	await loginAsDeveloperAtDashboard(page)
	await page.getByRole('button', { name: 'Create Site', exact: true }).first().click()
	await page.getByLabel('Site Name', { exact: true }).fill('Preview regression')
	await page.getByRole('button', { name: 'Next', exact: true }).click()
	await page.getByRole('tab', { name: 'Marketplace', exact: true }).click()
	const starterCard = page.getByRole('button', { name: /Snapshot Starter/ })
	await assertSafePreview(starterCard.locator('iframe'))
	await starterCard.click()
	await assertSafePreview(page.locator('.wizard-preview iframe'))
	await expect(page.getByRole('link', { name: 'Open live preview' })).toHaveAttribute('href', liveSite)
	// Replacing a selected snapshot must not leave the previous site's content.
	await page.getByRole('button', { name: /Missing Preview/ }).click()
	await expect(page.locator('.wizard-preview iframe')).toHaveCount(0)
	await expect(page.locator('.wizard-preview').getByRole('status')).toHaveText('Preview unavailable')
	await starterCard.click()
	await assertSafePreview(page.locator('.wizard-preview iframe'))
	expect(probes.liveNavigations).toEqual([])
	expect(probes.credentialLeaks).toEqual([])
	expect(probes.activeRequests).toEqual([])
})
