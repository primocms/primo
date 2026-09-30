import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

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
