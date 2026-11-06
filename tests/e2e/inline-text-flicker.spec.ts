import { test, expect } from '@playwright/test'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText, openBlockContentModal } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

test('inline text stays visible between blur and the preview update', async ({ page, request }) => {
	test.setTimeout(60000)
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Inline text flicker')
	await loginAsDeveloper(page, ids.siteId)
	const headline = canvasFrame(page).locator('[data-testid="headline"]')
	await expect(headline).toHaveAttribute('contenteditable', 'true')
	const iframe = page.locator('main iframe').first()

	// Make the cross-window delivery gap long enough to sample reliably.
	// A slow frame must keep showing the user's edit throughout that gap.
	await iframe.evaluate((element: HTMLIFrameElement) => {
		const win = element.contentWindow as any
		win.originalPostMessage = win.postMessage.bind(win)
		win.postMessage = (...args: any[]) => setTimeout(() => win.originalPostMessage(...args), 150)
	})
	const edited = 'The edited headline stays visible'
	await replaceContentEditableText(page, headline, edited)
	await iframe.evaluate((element: HTMLIFrameElement) => {
		const win = element.contentWindow as any
		win.visibleTextSamples = []
		win.sampleText = true
		const sample = () => {
			win.visibleTextSamples.push(win.document.querySelector('[data-testid="headline"]').textContent)
			if (win.sampleText) win.requestAnimationFrame(sample)
		}
		sample()
	})
	await headline.blur()
	await expect(headline).toHaveText(edited)
	await page.waitForTimeout(400)
	const samples = await iframe.evaluate((element: HTMLIFrameElement) => {
		const win = element.contentWindow as any
		win.sampleText = false
		return win.visibleTextSamples as string[]
	})
	expect(samples.length).toBeGreaterThan(2)
	expect([...new Set(samples)]).toEqual([edited])

	// Refocusing before a queued preview arrives must preserve the next edit
	// and the original Svelte nodes, even when both edits use the same field.
	await replaceContentEditableText(page, headline, 'First rapid edit')
	await headline.blur()
	await replaceContentEditableText(page, headline, edited)
	await page.waitForTimeout(250)
	await expect(headline).toHaveText(edited)
	await headline.blur()
	await page.waitForTimeout(250)
	await expect(headline).toHaveText(edited)
	await iframe.evaluate((element: HTMLIFrameElement) => {
		const win = element.contentWindow as any
		win.postMessage = win.originalPostMessage
	})

	// An unchanged save still needs to restore replaced DOM nodes, so future
	// prop updates (including modal edits) reach the visible text.
	await replaceContentEditableText(page, headline, edited)
	await headline.blur()
	await expect(headline).toHaveText(edited)
	const dialog = await openBlockContentModal(page, headline)
	await dialog.getByRole('textbox', { name: 'Headline', exact: true }).fill('A later modal edit')
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog).toBeHidden()
	await expect(headline).toHaveText('A later modal edit')
})
