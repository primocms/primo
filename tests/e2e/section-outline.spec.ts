import { test, expect } from '@playwright/test'
import { loginAsDeveloper, canvasFrame } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

test('section outlines fade on editing and leaving, and return on a fresh hover', async ({ page, request }) => {
	test.setTimeout(60000)
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Section outlines')
	await loginAsDeveloper(page, ids.siteId)

	const section = page.locator(`[data-section="${ids.sectionId}"]`)
	const row = page.locator(`[data-outline-id="${ids.sectionId}"] .select`)
	const headline = canvasFrame(page).locator('[data-testid="headline"]')
	const toolbar = page.locator('.BlockToolbar')
	await expect(headline).toBeVisible()
	await expect(page.locator('#Page')).toHaveClass(/fadein/)
	await headline.hover()
	await expect(toolbar).toBeVisible()

	await headline.click()
	await expect(toolbar).toBeHidden()
	await expect(section).not.toHaveClass(/outline-selected/)
	await expect(section).toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)')
	await page.keyboard.type(' Editing')
	await headline.hover({ position: { x: 20, y: 15 } })
	await expect(toolbar).toBeHidden()
	await expect(row).toHaveAttribute('aria-pressed', 'true')

	// Leaving and returning restores access to section controls.
	await page.getByRole('tab', { name: 'Outline', exact: true }).hover()
	await headline.hover()
	await expect(toolbar).toBeVisible()
	await page.getByRole('tab', { name: 'Outline', exact: true }).hover()
	await expect(toolbar).toBeHidden()

	// Sidebar navigation highlights the destination without pinning its outline.
	await row.click()
	await expect(section).toHaveClass(/outline-selected/)
	await headline.hover()
	await page.getByRole('tab', { name: 'Outline', exact: true }).hover()
	await expect(section).not.toHaveClass(/outline-selected/)
	await expect(section).toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)')
	await expect(toolbar).toBeHidden()
	await expect(row).toHaveAttribute('aria-pressed', 'true')
})
