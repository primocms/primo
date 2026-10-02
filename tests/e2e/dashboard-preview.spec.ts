import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'
import { canvasFrame, replaceContentEditableText, stubExternalImages } from './helpers/editor'

// Use a local alias to exercise the hosted dashboard's realtime subscriptions;
// the app intentionally disables subscriptions on localhost and 127.0.0.1.
test.use({ launchOptions: { args: ['--host-resolver-rules=MAP primo-preview.test 127.0.0.1', '--no-proxy-server'] } })
const browserURL = TEST_SERVER_URL.replace('127.0.0.1', 'primo-preview.test')

test('dashboard thumbnails keep their styles when page scripts would change the markup', async ({ page, request }) => {
	const { token, record } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Static Preview Fixture')
	const headers = { Authorization: `Bearer ${token}` }

	// Real site assets must resolve through the iframe document's site ID,
	// even though the asset URLs themselves don't have query parameters.
	const cssRes = await request.post(`${TEST_SERVER_URL}/api/collections/site_uploads/records`, {
		headers,
		multipart: {
			site: ids.siteId,
			file: { name: 'thumbnail.css', mimeType: 'text/css', buffer: Buffer.from('.styled { color: rgb(12, 34, 56); }') }
		}
	})
	expect(cssRes.ok(), await cssRes.text()).toBeTruthy()
	const css = await cssRes.json()
	const scriptRes = await request.post(`${TEST_SERVER_URL}/api/collections/site_uploads/records`, {
		headers,
		multipart: {
			site: ids.siteId,
			file: { name: 'thumbnail.js', mimeType: 'text/javascript', buffer: Buffer.from('document.querySelector("#headline").className = "";') }
		}
	})
	expect(scriptRes.ok(), await scriptRes.text()).toBeTruthy()
	const script = await scriptRes.json()
	function documentHTML(headline: string) {
		return `<!DOCTYPE html><html><head><link rel="stylesheet" href="/_uploads/${css.file}"></head><body>
			<h1 id="headline" class="styled">${headline}</h1>
			<script>document.querySelector('#headline').textContent = 'Script ran';</script>
			<script type="module" src="/_uploads/${script.file}"></script>
		</body></html>`
	}
	const publishedRes = await request.patch(`${TEST_SERVER_URL}/api/collections/pages/records/${ids.pageId}`, {
		headers,
		multipart: { compiled_html: { name: 'index.html', mimeType: 'text/html', buffer: Buffer.from(documentHTML('Published homepage')) } }
	})
	expect(publishedRes.ok(), await publishedRes.text()).toBeTruthy()
	const generated = await request.post(`${TEST_SERVER_URL}/api/primo/generate`, { headers, data: { site_id: ids.siteId } })
	expect(generated.ok(), await generated.text()).toBeTruthy()

	async function uploadPreview(headline: string) {
		const response = await request.patch(`${TEST_SERVER_URL}/api/collections/sites/records/${ids.siteId}`, {
			headers,
			multipart: { preview: { name: 'index.html', mimeType: 'text/html', buffer: Buffer.from(documentHTML(headline)) } }
		})
		expect(response.ok(), await response.text()).toBeTruthy()
	}
	await uploadPreview('Stored preview')
	await page.addInitScript(
		({ token, record }) => {
			localStorage.setItem('pocketbase_auth', JSON.stringify({ token, record }))
		},
		{ token, record }
	)
	const subscribed = page.waitForResponse((response) => response.url().includes('/api/realtime') && response.request().method() === 'POST')
	await page.goto(`${browserURL}/admin/dashboard/sites`)
	await subscribed
	const thumbnail = page.frameLocator(`iframe[src*="_site=${ids.siteId}"]`)
	await expect(page.locator(`iframe[src*="_site=${ids.siteId}"]`)).toHaveAttribute('src', /[?&]_preview=1(?:&|$)/)
	await expect(thumbnail.locator('#headline')).toHaveText('Stored preview')
	await expect(thumbnail.locator('#headline')).toHaveClass('styled')
	await expect(thumbnail.locator('#headline')).toHaveCSS('color', 'rgb(12, 34, 56)')
	const iframe = page.frames().find((frame) => frame.url().includes(`_site=${ids.siteId}`))!
	await iframe.waitForLoadState('load')
	await expect(thumbnail.locator('#headline')).toHaveText('Stored preview')
	await expect(thumbnail.locator('#headline')).toHaveClass('styled')

	// An ordinary site update must not leave an old preview filename in the
	// change cache that masks a subsequent preview-only realtime update.
	const renamed = await request.patch(`${TEST_SERVER_URL}/api/collections/sites/records/${ids.siteId}`, {
		headers,
		data: { name: 'Renamed preview fixture' }
	})
	expect(renamed.ok(), await renamed.text()).toBeTruthy()
	await expect(page.getByText('Renamed preview fixture', { exact: true })).toBeVisible()

	// A new preview filename must reload the already-mounted dashboard card.
	await uploadPreview('Updated preview')
	await expect(thumbnail.locator('#headline')).toHaveText('Updated preview')
	await expect(thumbnail.locator('#headline')).toHaveCSS('color', 'rgb(12, 34, 56)')

	// The live preview still executes both scripts; only thumbnails block them.
	await page.goto(`${browserURL}/?_site=${ids.siteId}`)
	await expect(page.locator('#headline')).toHaveText('Script ran')
	await expect(page.locator('#headline')).toHaveAttribute('class', '')
})

test('dashboard previews stay styled after the first UI build and a second UI build', async ({ page, context, request }) => {
	test.setTimeout(90000)
	const { token, record } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Build Preview Fixture')
	const headers = { Authorization: `Bearer ${token}` }
	const symbolRes = await request.get(`${TEST_SERVER_URL}/api/collections/site_symbols/records/${ids.symbolId}`, { headers })
	expect(symbolRes.ok()).toBeTruthy()
	const symbol = await symbolRes.json()
	const symbolUpdate = await request.patch(`${TEST_SERVER_URL}/api/collections/site_symbols/records/${ids.symbolId}`, {
		headers,
		data: {
			css: '.content-block { padding: 2rem; } h1 { color: rgb(12, 34, 56); font-size: 32px; }',
			js: `${symbol.js}\nif (typeof window !== 'undefined' && window.frameElement?.title === 'site preview') {
					setTimeout(() => {
						document.querySelector('[data-testid="headline"]').className = '';
					}, 0);
				}`
		}
	})
	expect(symbolUpdate.ok(), await symbolUpdate.text()).toBeTruthy()
	await context.addInitScript(
		({ token, record }) => {
			localStorage.setItem('pocketbase_auth', JSON.stringify({ token, record }))
		},
		{ token, record }
	)
	await stubExternalImages(page)
	await page.goto(`${browserURL}/admin/sites/${ids.siteId}`)
	const headline = canvasFrame(page).locator('[data-testid="headline"]')
	await expect(headline).toBeVisible({ timeout: 30000 })

	// Keep the dashboard open during both real builds to verify that its
	// existing card reloads only when the fresh preview has been uploaded.
	const dashboard = await context.newPage()
	await stubExternalImages(dashboard)
	const subscribed = dashboard.waitForResponse((response) => response.url().includes('/api/realtime') && response.request().method() === 'POST')
	await dashboard.goto(`${browserURL}/admin/dashboard/sites`)
	await subscribed
	const iframe = dashboard.locator(`iframe[src*="_site=${ids.siteId}"]`)
	const thumbnailHeadline = iframe.contentFrame().locator('[data-testid="headline"]')
	let previousSrc: string | null = null
	for (const { text, color, size } of [
		{ text: 'First UI build', color: 'rgb(12, 34, 56)', size: '32px' },
		{ text: 'Second UI build', color: 'rgb(78, 90, 123)', size: '36px' }
	]) {
		if (previousSrc) {
			const updated = await request.patch(`${TEST_SERVER_URL}/api/collections/site_symbols/records/${ids.symbolId}`, {
				headers,
				data: { css: `.content-block { padding: 2rem; } h1 { color: ${color}; font-size: ${size}; }` }
			})
			expect(updated.ok(), await updated.text()).toBeTruthy()
			await page.reload()
			await expect(headline).toBeVisible({ timeout: 30000 })
		}
		const saved = page.waitForResponse((response) => response.url().includes('/api/collections/page_section_entries/records/') && response.request().method() === 'PATCH')
		await replaceContentEditableText(page, headline, text)
		await headline.blur()
		expect((await saved).ok()).toBeTruthy()
		await page.getByRole('button', { name: 'Preview', exact: true }).click()
		const dialog = page.getByRole('dialog')
		await dialog.getByRole('button', { name: 'Build preview', exact: true }).click()
		const result = dialog.getByRole('heading', { name: /Preview ready|Preview failed/ })
		await expect(result).toBeVisible({ timeout: 45000 })
		await expect(result, await dialog.innerText()).toHaveText('Preview ready')
		await expect(thumbnailHeadline).toHaveText(text)
		await expect(thumbnailHeadline).toHaveClass(/svelte-/)
		await expect(thumbnailHeadline).toHaveCSS('color', color)
		await expect(thumbnailHeadline).toHaveCSS('font-size', size)
		const frame = dashboard.frames().find((frame) => frame.url().includes(`_site=${ids.siteId}`))!
		await frame.waitForLoadState('load')
		await expect(thumbnailHeadline).toHaveClass(/svelte-/)
		const src = await iframe.getAttribute('src')
		expect(src).not.toBe(previousSrc)
		previousSrc = src
		await dialog.getByRole('button', { name: 'Done', exact: true }).click()
	}
	await dashboard.reload()
	await expect(thumbnailHeadline).toHaveText('Second UI build')
	await expect(thumbnailHeadline).toHaveCSS('color', 'rgb(78, 90, 123)')
})
