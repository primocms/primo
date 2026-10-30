import { test, expect } from '@playwright/test'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

test('rich text never flashes old content during delayed saves or rapid field changes', async ({ page, request }) => {
	test.setTimeout(60000)
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Rich text flicker')
	const headers = { Authorization: `Bearer ${token}` }
	const entries = await request.get('/api/collections/page_section_entries/records', {
		headers, params: { filter: `section = "${ids.sectionId}" && field = "${ids.fieldIds.body}"` }
	})
	const entry = (await entries.json()).items[0]
	const patched = await request.patch(`/api/collections/page_section_entries/records/${entry.id}`, {
		headers,
		data: { value: { type: 'doc', content: [
			{ type: 'paragraph', content: [{ type: 'text', text: 'Original rich text.' }] },
			{ type: 'paragraph', content: [{ type: 'text', text: 'Formatted paragraph stays.', marks: [{ type: 'italic' }] }] },
			{ type: 'image', attrs: { src: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400', alt: 'Retained embedded image' } }
		] } }
	})
	expect(patched.ok()).toBe(true)
	const errors: string[] = []
	page.on('pageerror', error => errors.push(error.message))
	await loginAsDeveloper(page, ids.siteId)
	const frame = canvasFrame(page)
	const body = frame.locator('[data-testid="body"]')
	const rich = body.locator('.ProseMirror')
	const headline = frame.locator('[data-testid="headline"]')
	const iframe = page.locator('main iframe').first()
	await expect(rich).toBeVisible()
	await expect(rich.locator('img')).toBeVisible()
	await expect.poll(() => rich.locator('img').evaluate((img: HTMLImageElement) => img.complete)).toBe(true)
	await iframe.evaluate((element: HTMLIFrameElement) => {
		const win = element.contentWindow as any
		win.originalRichEditor = win.document.querySelector('.ProseMirror')
		win.originalRichImage = win.originalRichEditor.querySelector('img')
		win.originalPostMessage = win.postMessage.bind(win)
		win.postMessage = (...args: any[]) => setTimeout(() => win.originalPostMessage(...args), 150)
		win.richRenders = 0
		win.document.addEventListener('primo-rendered', () => win.richRenders++)
	})

	async function editParagraph(text: string) {
		// Native paragraph selection updates ProseMirror's selection as well as
		// the DOM. A programmatic Range can race Firefox's focus handling.
		const paragraph = rich.locator('p').first()
		const previous = (await paragraph.textContent())!.trim()
		await rich.focus()
		await expect(rich).toBeFocused()
		await paragraph.click({ clickCount: 3, position: { x: 8, y: 8 } })
		await expect.poll(() => rich.evaluate(element => element.ownerDocument.getSelection()?.toString().trim())).toBe(previous)
		await page.keyboard.type(text)
		await expect(rich.locator('p').first()).toHaveText(text)
	}
	async function startSampling() {
		return iframe.evaluate((element: HTMLIFrameElement) => {
			const win = element.contentWindow as any
			win.richSamples = []
			win.sampleRichText = true
			const body = win.document.querySelector('[data-testid="body"]')
			const expected = body.textContent
			const sample = () => {
				win.richSamples.push({ text: body.textContent, editor: body.querySelector('.ProseMirror') === win.originalRichEditor && win.originalRichEditor.isConnected,
					image: body.querySelector('img') === win.originalRichImage && win.originalRichImage.isConnected })
				if (win.sampleRichText) win.requestAnimationFrame(sample)
			}
			sample()
			return { expected, renders: win.richRenders }
		})
	}
	async function expectStable(snapshot: { expected: string; renders: number }) {
		await expect.poll(() => iframe.evaluate((element: HTMLIFrameElement) => (element.contentWindow as any).richRenders)).toBeGreaterThan(snapshot.renders)
		await page.waitForTimeout(350)
		const samples = await iframe.evaluate((element: HTMLIFrameElement) => {
			const win = element.contentWindow as any
			win.sampleRichText = false
			return win.richSamples as { text: string; editor: boolean; image: boolean }[]
		})
		expect(samples.length).toBeGreaterThan(2)
		expect([...new Set(samples.map(sample => sample.text))]).toEqual([snapshot.expected])
		expect(samples.every(sample => sample.editor && sample.image)).toBe(true)
		await expect(rich.locator('em')).toHaveText('Formatted paragraph stays.')
	}

	// Blur before the save debounce expires; sample every paint while the
	// preview is delayed and while its backing HTML is updated.
	await editParagraph('Edited rich text stays visible.')
	let snapshot = await startSampling()
	await rich.blur()
	await expectStable(snapshot)

	// A preview already in flight must not overwrite a new rich-text edit.
	await editParagraph('First rapid rich-text edit.')
	await rich.blur()
	await editParagraph('Latest rapid rich-text edit.')
	snapshot = await startSampling()
	await page.waitForTimeout(250)
	await rich.blur()
	await expectStable(snapshot)

	// Switching to a plain-text field must also preserve the rich-text surface.
	await editParagraph('Final rich-text edit.')
	snapshot = await startSampling()
	await replaceContentEditableText(page, headline, 'Edited adjacent headline')
	await page.waitForTimeout(250)
	await headline.blur()
	await expectStable(snapshot)
	await expect.poll(async () => JSON.stringify((await (await request.get(`/api/collections/page_section_entries/records/${entry.id}`, { headers })).json()).value)).toContain('Final rich-text edit.')
	expect(errors).toEqual([])
	await page.reload()
	const restored = canvasFrame(page).locator('[data-testid="body"] .ProseMirror')
	await expect(restored.locator('p').first()).toHaveText('Final rich-text edit.')
	await expect(restored.locator('em')).toHaveText('Formatted paragraph stays.')
	await expect(restored.locator('img')).toHaveAttribute('alt', 'Retained embedded image')
})
