import { test, expect } from '@playwright/test'
import { loginAsDeveloper, canvasFrame } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite

test.describe('Sidebar resize release', () => {
	test.beforeAll(async ({ request }) => {
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'Sidebar Resize Fixture')
	})

	test.beforeEach(async ({ page }) => {
		await loginAsDeveloper(page, ids.siteId)
		await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
	})

	for (const collapse of [false, true]) {
		test(`release over an iframe ends a ${collapse ? 'collapsing drag' : 'resizer click'}`, async ({ page }) => {
			const handle = page.locator('.editor-panes > [data-pane-resizer]')
			const sidebar = page.locator('#editor-sidebar')
			const box = (await handle.boundingBox())!
			const viewport = page.viewportSize()!
			const releaseX = collapse ? viewport.width * 0.05 : box.x + box.width / 2
			const releaseY = box.y + box.height / 2

			await page.mouse.move(box.x + box.width / 2, releaseY)
			await page.mouse.down()
			await expect(handle).toHaveAttribute('data-active', 'pointer')
			if (collapse) {
				await page.mouse.move(releaseX, releaseY, { steps: 10 })
				await expect(sidebar.locator('.expand')).toBeVisible()
			}

			// A child with explicit pointer-events can receive a release even
			// though Paneforge disables pointer events on the parent pane.
			// Put an iframe under the release position to exercise that boundary.
			await page.evaluate(
				({ x, y }) => {
					const iframe = document.createElement('iframe')
					iframe.id = 'release-frame'
					iframe.srcdoc = '<body>Release target</body>'
					iframe.style.cssText = `position:fixed;left:${x - 20}px;top:${y - 20}px;width:40px;height:40px;z-index:99999;pointer-events:auto;`
					document.querySelector('.editor-canvas')!.append(iframe)
				},
				{ x: releaseX, y: releaseY }
			)
			await expect(page.frameLocator('#release-frame').locator('body')).toHaveText('Release target')
			await page.mouse.up()
			await expect(handle).not.toHaveAttribute('data-active', 'pointer')
			await expect(sidebar).not.toHaveCSS('pointer-events', 'none')
			const releasedWidth = (await sidebar.boundingBox())!.width
			await page.mouse.move(viewport.width * 0.5, releaseY)
			await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeCloseTo(releasedWidth, 1)
			await page.locator('#release-frame').evaluate((node) => node.remove())
			if (collapse) {
				await sidebar.locator('.expand button').click()
				await expect(sidebar.locator('.expand')).toHaveCount(0)
			}
		})
	}

	test('non-primary buttons never start an uncaptured drag', async ({ page }) => {
		const handle = page.locator('.editor-panes > [data-pane-resizer]')
		const box = (await handle.boundingBox())!
		for (const button of ['middle', 'right'] as const) {
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
			await page.mouse.down({ button })
			await expect(handle).not.toHaveAttribute('data-active', 'pointer')
			await page.mouse.move(box.x + 100, box.y + box.height / 2)
			await page.mouse.up({ button })
			await expect(page.locator('#editor-sidebar')).not.toHaveCSS('pointer-events', 'none')
		}
	})

	test('losing window focus clears an active drag', async ({ page }) => {
		const handle = page.locator('.editor-panes > [data-pane-resizer]')
		const sidebar = page.locator('#editor-sidebar')
		const box = (await handle.boundingBox())!
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.down()
		await expect(handle).toHaveAttribute('data-active', 'pointer')
		await page.evaluate(() => window.dispatchEvent(new Event('blur')))
		await expect(handle).not.toHaveAttribute('data-active', 'pointer')
		await expect(sidebar).not.toHaveCSS('pointer-events', 'none')
		await page.mouse.up()
	})
})
