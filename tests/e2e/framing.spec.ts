import { createServer, type Server } from 'node:http'
import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

let preview: string
let parentServer: Server
let foreignParent: string

const parentHtml = () => `<iframe src="${preview}" title="framing-check" onload="document.body.dataset.loaded='yes'"></iframe>`

test.beforeAll(async ({ request }) => {
	const { token } = await devAuth(request)
	const { siteId } = await seedFixtureSite(token, 'Framing Fixture')
	const response = await request.patch(`${TEST_SERVER_URL}/api/collections/sites/records/${siteId}`, {
		headers: { Authorization: `Bearer ${token}` },
		multipart: { preview: { name: 'preview.html', mimeType: 'text/html', buffer: Buffer.from('<h1 data-testid="framed-content">Same-origin preview</h1>') } }
	})
	expect(response.ok()).toBeTruthy()
	preview = `${TEST_SERVER_URL}/?_site=${siteId}&_preview=1`
	parentServer = createServer((_request, response) => {
		response.writeHead(200, { 'Content-Type': 'text/html' })
		response.end(parentHtml())
	})
	await new Promise<void>(resolve => parentServer.listen(0, '127.0.0.1', resolve))
	const address = parentServer.address()
	if (!address || typeof address === 'string') throw new Error('Missing disposable parent port')
	foreignParent = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
	if (parentServer) {
		parentServer.closeAllConnections()
		await new Promise<void>((resolve, reject) => parentServer.close(error => error ? reject(error) : resolve()))
	}
})

test('same-origin dashboard frames remain usable under the framing policy', async ({ page }) => {
	await page.route(`${TEST_SERVER_URL}/__qa-framing-parent`, route => route.fulfill({ contentType: 'text/html', body: parentHtml() }))
	await page.goto(`${TEST_SERVER_URL}/__qa-framing-parent`)
	await expect(page.frameLocator('iframe').getByTestId('framed-content')).toHaveText('Same-origin preview')
})

test('a different-origin parent cannot embed the same preview', async ({ page, request }) => {
	const response = await request.get(preview)
	expect(response.headers()['content-security-policy']).toBe("frame-ancestors 'self'; script-src 'none'")
	const childResponse = page.waitForResponse(response => response.url() === preview)
	await page.goto(foreignParent)
	expect((await childResponse).ok()).toBeTruthy()
	await expect(page.locator('body')).toHaveAttribute('data-loaded', 'yes')
	for (const frame of page.frames().filter(frame => frame !== page.mainFrame())) {
		expect(await frame.locator('[data-testid="framed-content"]').count()).toBe(0)
	}
})
