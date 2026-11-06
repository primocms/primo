import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

let preview: string

test.beforeAll(async ({ request }) => {
	const { token } = await devAuth(request)
	const { siteId } = await seedFixtureSite(token, 'Same-origin Framing Fixture')
	const response = await request.patch(`${TEST_SERVER_URL}/api/collections/sites/records/${siteId}`, {
		headers: { Authorization: `Bearer ${token}` },
		multipart: { preview: { name: 'preview.html', mimeType: 'text/html', buffer: Buffer.from('<h1 data-testid="framed-content">Same-origin preview</h1>') } }
	})
	expect(response.ok()).toBeTruthy()
	preview = `${TEST_SERVER_URL}/?_site=${siteId}&_preview=1`
})

test('same-origin dashboard frames remain usable under the framing policy', async ({ page }) => {
	await page.route(`${TEST_SERVER_URL}/__qa-framing-parent`, route => route.fulfill({ contentType: 'text/html', body: `<iframe src="${preview}" title="framing-check"></iframe>` }))
	await page.goto(`${TEST_SERVER_URL}/__qa-framing-parent`)
	await expect(page.frameLocator('iframe').getByTestId('framed-content')).toHaveText('Same-origin preview')
})
