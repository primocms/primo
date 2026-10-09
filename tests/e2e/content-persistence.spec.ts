import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite

test.describe('Content persistence', () => {
	test.beforeAll(async ({ request }) => {
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'Content Persistence Fixture')
	})

	test('position-only edits preserve uploaded image identity after reload', async ({ page, request }) => {
		const { token } = await devAuth(request)
		const headers = { Authorization: `Bearer ${token}` }
		const uploadRes = await request.post(`${TEST_SERVER_URL}/api/collections/site_uploads/records`, {
			headers,
			multipart: {
				site: ids.siteId,
				file: {
					name: 'focal-point.png',
					mimeType: 'image/png',
					buffer: Buffer.from(
						'iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAkElEQVR4nO3RMREAIBDAsJeIJjThD2TQIUP23nXOXpeO+R2AIWmGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0jMA8FGOIiljfewAAAAAElFTkSuQmCC',
						'base64'
					)
				}
			}
		})
		expect(uploadRes.ok()).toBeTruthy()
		const upload = await uploadRes.json()
		const entries = await (await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, { headers, params: { filter: `section = "${ids.sectionId}"` } })).json()
		const imageEntry = entries.items.find((e) => e.field === ids.fieldIds.image)
		const original = { upload: upload.id, url: '', alt: 'Uploaded fixture', width: 100, height: 50 }
		const patched = await request.patch(`${TEST_SERVER_URL}/api/collections/page_section_entries/records/${imageEntry.id}`, { headers, data: { value: original } })
		expect(patched.ok()).toBeTruthy()
		await loginAsDeveloper(page, ids.siteId)
		const image = canvasFrame(page).locator('[data-testid="image"]')
		await expect(image).toBeVisible()
		await image.hover()
		await page.locator('.image-editor-overlay .edit-button').click({ force: true })
		const dialog = page.getByRole('dialog')
		const position = dialog.getByRole('button', { name: /Adjust position at/ })
		await position.press('ArrowRight')
		await dialog.getByRole('button', { name: 'Save', exact: true }).click()
		await expect.poll(async () => (await (await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records/${imageEntry.id}`, { headers })).json()).value.focal_point?.x).toBe(0.51)
		const saved = await (await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records/${imageEntry.id}`, { headers })).json()
		expect(saved.value.upload).toBe(upload.id)
		await page.reload()
		await expect(canvasFrame(page).locator('[data-testid="image"]')).toHaveAttribute('src', new RegExp(`/site_uploads/${upload.id}/`))
	})

	test('headline, rich text, and image edits survive reload and a new browser session', async ({ page, browser, request }) => {
		const { token } = await devAuth(request)
		await loginAsDeveloper(page, ids.siteId)

		const frame = canvasFrame(page)
		const headline = frame.locator('[data-testid="headline"]')
		await expect(headline).toBeVisible({ timeout: 15000 })

		const newHeadline = `Edited Headline ${Date.now()}`
		await replaceContentEditableText(page, headline, newHeadline)
		await headline.blur()

		// wait for the debounced PATCH to page_section_entries to complete
		await page.waitForResponse((res) => res.url().includes('/api/collections/page_section_entries/records/') && res.request().method() === 'PATCH', { timeout: 5000 })

		// rich text: click into the body div (TipTap-mounted), select all, retype
		const body = frame.locator('[data-testid="body"]')
		await replaceContentEditableText(page, body, 'Edited body text.')
		await body.blur()
		await page.waitForTimeout(1000) // TipTap onBlur save has its own debounce path

		// image: hovering reveals a click-to-edit overlay (ImageOverlay,
		// ComponentNode.svelte's attach_image_overlay) that sits on top of
		// the <img> and intercepts plain clicks — click the overlay itself
		// (force, since it's visually thin) rather than the underlying img.
		const image = frame.locator('[data-testid="image"]')
		await image.hover()
		await image.click({ force: true })
		const imageDialog = page.getByRole('dialog')
		await expect(imageDialog).toBeVisible({ timeout: 5000 })
		const newImageUrl = 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80'
		const urlInput = imageDialog.locator('label:has-text("URL") input')
		await urlInput.fill(newImageUrl)
		await imageDialog.getByRole('button', { name: 'Save' }).click()
		await expect(imageDialog).toBeHidden({ timeout: 5000 })
		await page.waitForTimeout(1000) // save_edited_value debounce

		// Verify via API (ground truth, not just DOM) before reload
		const entriesRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
			headers: { Authorization: `Bearer ${token}` },
			params: { filter: `section = "${ids.sectionId}"` }
		})
		const entries = (await entriesRes.json()).items
		const headlineEntry = entries.find((e: any) => e.field === ids.fieldIds.headline)
		expect(headlineEntry.value).toBe(newHeadline)
		const imageEntry = entries.find((e: any) => e.field === ids.fieldIds.image)
		expect(imageEntry.value.url).toBe(newImageUrl)

		// Reload same session
		await page.reload()
		const reloadedFrame = canvasFrame(page)
		await expect(reloadedFrame.locator('[data-testid="headline"]')).toHaveText(newHeadline, { timeout: 15000 })
		await expect(reloadedFrame.locator('[data-testid="body"]')).toContainText('Edited body text.')
		await expect(reloadedFrame.locator('[data-testid="image"]')).toHaveAttribute('src', newImageUrl)

		// New browser context (fresh storage state, re-auth) — confirms
		// persistence is server-side, not just this tab's cache.
		const context2 = await browser.newContext()
		const page2 = await context2.newPage()
		await loginAsDeveloper(page2, ids.siteId)
		const frame2 = canvasFrame(page2)
		await expect(frame2.locator('[data-testid="headline"]')).toHaveText(newHeadline, { timeout: 15000 })
		await expect(frame2.locator('[data-testid="body"]')).toContainText('Edited body text.')
		await expect(frame2.locator('[data-testid="image"]')).toHaveAttribute('src', newImageUrl)
		await context2.close()
	})
})
