import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText, openBlockContentModal } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite

test.describe('Section content updates', () => {
	test.beforeAll(async ({ request }) => {
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'Image Preservation Fixture')
		const entries = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
			headers: { Authorization: `Bearer ${token}` },
			params: { filter: `section = "${ids.sectionId}" && field = "${ids.fieldIds.body}"` }
		})
		const entry = (await entries.json()).items[0]
		const response = await request.patch(`${TEST_SERVER_URL}/api/collections/page_section_entries/records/${entry.id}`, {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				value: {
					type: 'doc',
					content: [
						{ type: 'paragraph', content: [{ type: 'text', text: 'Original body text.' }] },
						{ type: 'image', attrs: { src: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400', alt: 'Embedded image' } }
					]
				}
			}
		})
		expect(response.ok()).toBe(true)
	})

	test('inline and modal text saves retain images and the rich-text editor', async ({ page, request }) => {
		test.setTimeout(60000)
		const { token } = await devAuth(request)
		const errors: string[] = []
		page.on('pageerror', (error) => errors.push(error.message))
		await loginAsDeveloper(page, ids.siteId)
		const frame = canvasFrame(page)
		const headline = frame.locator('[data-testid="headline"]')
		await expect(headline).toHaveAttribute('contenteditable', 'true', { timeout: 15000 })
		await expect(frame.locator('.ProseMirror')).toBeVisible()
		await expect(frame.locator('.ProseMirror img')).toHaveCount(1)
		await expect.poll(() => frame.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete))).toBe(true)
		const document = await page.locator('main iframe').first().elementHandle()
		await document!.evaluate((iframe: HTMLIFrameElement) => {
			const win = iframe.contentWindow as any
			win.originalImage = win.document.querySelector('[data-testid="image"]')
			win.originalEditor = win.document.querySelector('.ProseMirror')
			win.originalEmbeddedImage = win.document.querySelector('.ProseMirror img')
			win.imageLoads = 0
			win.document.addEventListener(
				'load',
				(event: any) => {
					if (event.target === win.originalImage) win.imageLoads++
				},
				true
			)
		})

		async function expectRetained() {
			expect(
				await document!.evaluate((iframe: HTMLIFrameElement) => {
					const win = iframe.contentWindow as any
					return {
						image: win.originalImage === win.document.querySelector('[data-testid="image"]') && win.originalImage.isConnected,
						editor: win.originalEditor === win.document.querySelector('.ProseMirror') && win.originalEditor.isConnected,
						embeddedImage: win.originalEmbeddedImage === win.document.querySelector('.ProseMirror img') && win.originalEmbeddedImage.isConnected,
						loads: win.imageLoads
					}
				})
			).toEqual({ image: true, editor: true, embeddedImage: true, loads: 0 })
		}
		const savedEntry = (field: string) =>
			request
				.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
					headers: { Authorization: `Bearer ${token}` },
					params: { filter: `section = "${ids.sectionId}" && field = "${ids.fieldIds[field]}"` }
				})
				.then((res) => res.json())
				.then((data) => data.items[0].value)

		// Replacing text with the same value must also preserve its live binding.
		await replaceContentEditableText(page, headline, 'Original Headline')
		await headline.blur()
		await expect(headline).toHaveText('Original Headline')
		await replaceContentEditableText(page, headline, 'Saved inline headline')
		await headline.blur()
		await expect.poll(() => savedEntry('headline')).toBe('Saved inline headline')
		await expectRetained()

		// A modal edit after an inline edit also verifies that Svelte still owns
		// the text nodes the browser's contenteditable operation replaced.
		const dialog = await openBlockContentModal(page, headline)
		const preview = dialog.locator('.code-preview iframe').contentFrame()
		await expect(preview.locator('[data-testid="headline"]')).toHaveText('Saved inline headline')
		await dialog.locator('.code-preview iframe').evaluate((iframe: HTMLIFrameElement) => {
			const win = iframe.contentWindow as any
			win.originalImages = [...win.document.images]
		})
		await dialog.getByRole('textbox', { name: 'Headline', exact: true }).fill('Saved modal headline')
		await expect(preview.locator('[data-testid="headline"]')).toHaveText('Saved modal headline')
		expect(
			await dialog.locator('.code-preview iframe').evaluate((iframe: HTMLIFrameElement) => {
				const win = iframe.contentWindow as any
				return win.originalImages.every((image: HTMLImageElement, index: number) => image === win.document.images[index] && image.isConnected)
			})
		).toBe(true)
		await dialog.getByRole('button', { name: 'Save', exact: true }).click()
		await expect(dialog).toBeHidden()
		await expect.poll(() => savedEntry('headline')).toBe('Saved modal headline')
		await expect(headline).toHaveText('Saved modal headline')
		await expectRetained()

		// Rich-text saves update the live editor without remounting the section.
		const richText = frame.locator('.ProseMirror')
		await richText
			.locator('p')
			.first()
			.evaluate((paragraph) => {
				;(paragraph.closest('.ProseMirror') as HTMLElement).focus()
				const range = paragraph.ownerDocument.createRange()
				range.selectNodeContents(paragraph)
				const selection = paragraph.ownerDocument.getSelection()!
				selection.removeAllRanges()
				selection.addRange(range)
			})
		await page.keyboard.type('Saved rich text')
		await richText.blur()
		await expect.poll(async () => JSON.stringify(await savedEntry('body'))).toContain('Saved rich text')
		await expectRetained()
		await replaceContentEditableText(page, headline, 'Saved a second time')
		await headline.blur()
		await expect.poll(() => savedEntry('headline')).toBe('Saved a second time')
		await expectRetained()
		expect(errors).toEqual([])

		await page.reload()
		await expect(canvasFrame(page).locator('[data-testid="headline"]')).toHaveText('Saved a second time', { timeout: 15000 })
		await expect(canvasFrame(page).locator('.ProseMirror')).toContainText('Saved rich text')
	})
})
