import { test, expect } from '@playwright/test'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'
import { loginAsDeveloper, canvasFrame, openBlockContentModal } from './helpers/editor'

const imageBytes = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAkElEQVR4nO3RMREAIBDAsJeIJjThD2TQIUP23nXOXpeO+R2AIWmGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0jMA8FGOIiljfewAAAAAElFTkSuQmCC',
	'base64'
)

test('repeater headers show uploaded images before saving and after reload', async ({ page, request }) => {
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Repeater thumbnails')
	const headers = { Authorization: `Bearer ${token}` }
	const uploadResponse = await request.post('/api/collections/site_uploads/records', {
		headers,
		multipart: { site: ids.siteId, file: { name: 'repeater.png', mimeType: 'image/png', buffer: imageBytes } }
	})
	expect(uploadResponse.ok()).toBeTruthy()
	const upload = await uploadResponse.json()
	const fieldResponse = await request.post('/api/collections/site_symbol_fields/records', {
		headers,
		data: { symbol: ids.symbolId, parent: ids.fieldIds.items, key: 'photo', label: 'Photo', type: 'image', index: 0 }
	})
	expect(fieldResponse.ok()).toBeTruthy()
	const imageField = await fieldResponse.json()
	const nameResponse = await request.patch(`/api/collections/site_symbol_fields/records/${ids.fieldIds.name}`, { headers, data: { index: 1 } })
	expect(nameResponse.ok()).toBeTruthy()
	const itemResponse = await request.post('/api/collections/page_section_entries/records', {
		headers,
		data: { section: ids.sectionId, field: ids.fieldIds.items, index: 0, locale: 'en' }
	})
	expect(itemResponse.ok()).toBeTruthy()
	const item = await itemResponse.json()
	for (const [field, value] of [
		[imageField.id, { upload: upload.id, url: '', alt: 'Uploaded repeater image' }],
		[ids.fieldIds.name, 'Photo item']
	]) {
		const response = await request.post('/api/collections/page_section_entries/records', {
			headers,
			data: { section: ids.sectionId, field, parent: item.id, index: 0, locale: 'en', value }
		})
		expect(response.ok()).toBeTruthy()
	}

	await loginAsDeveloper(page, ids.siteId)
	let dialog = await openBlockContentModal(page, canvasFrame(page).locator('[data-testid="headline"]'))
	let row = dialog.locator('.RepeaterFieldItem').first()
	let thumbnail = row.locator('button.title > img')
	await expect(thumbnail).toHaveAttribute('src', new RegExp(`/site_uploads/${upload.id}/`))
	await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(100)
	if (!(await row.locator('.ImageField').isVisible())) await row.locator('button.title').click()
	await row.locator('input[type="file"]').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: imageBytes })
	await expect(thumbnail).toHaveAttribute('src', /^blob:/)
	await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog).toBeHidden()
	await page.reload()
	dialog = await openBlockContentModal(page, canvasFrame(page).locator('[data-testid="headline"]'))
	row = dialog.locator('.RepeaterFieldItem').first()
	thumbnail = row.locator('button.title > img')
	await expect(thumbnail).toHaveAttribute('src', /\/api\/files\/site_uploads\//)
	await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
})
