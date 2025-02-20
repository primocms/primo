import { test, expect } from '@playwright/test'

test('Create and implement site field', async ({ page }) => {
	await page.goto('/1')
	await page.getByLabel('toolbar').getByRole('button').nth(1).click()
	await page.locator('[data-test-id="field"]').click()
	await page.getByPlaceholder('Heading', { exact: true }).fill('Title')
	await page.locator('[data-test-id="entry"]').click()
	await page.getByLabel('Title').click()
	await page.getByLabel('Title').fill('Test Title')
	await page.locator('.cm-content > div:nth-child(2)').click()
	await page.getByRole('button', { name: 'Save' }).click()
	await expect(page).toHaveTitle('Test Title')
	await page.reload()
	await expect(page).toHaveTitle('Test Title')
})

test('Update site design', async ({ page }) => {
	// Navigate to the test page
	await page.goto('/1')

	await page.getByLabel('toolbar').getByRole('button').nth(2).click()
	await page.waitForTimeout(2000) // wait for font api to load

	await page.getByRole('textbox').first().click()
	await page.getByRole('textbox').first().fill('Lato')
	await page.getByRole('button', { name: 'Search' }).click()
	await page.getByRole('button', { name: 'Lato' }).click()
	await page.getByLabel('Close', { exact: true }).click()

	await page.locator('label').filter({ hasText: 'Search fonts All Serif Sans Serif Display Handwriting Monospace Show Random' }).getByRole('textbox').click()
	await page.locator('label').filter({ hasText: 'Search fonts All Serif Sans Serif Display Handwriting Monospace Show Random' }).getByRole('textbox').fill('Merri')
	await page.getByRole('button', { name: 'Search' }).nth(1).click()
	await page.getByRole('button', { name: 'Merriweather', exact: true }).click()
	await page.getByLabel('Close', { exact: true }).click()

	await page.locator('[data-test-id="Primary Color"] .color').click()
	await page.getByRole('textbox', { name: 'hex color' }).fill('#20bdbd')
	await page.locator('[data-test-id="Primary Color"] .color').click()

	await page.locator('[data-test-id="Accent Color"] .color').click()
	await page.getByRole('textbox', { name: 'hex color' }).fill('#bc2020')
	await page.locator('[data-test-id="Accent Color"] .color').click()

	await page.locator('[data-target-id="design-shadow-range"]').fill('4')

	await page.getByRole('button', { name: 'Medium', exact: true }).click()
	await page.getByRole('button', { name: 'Save' }).click()
	// Check for multiple CSS variables and their values

	await page.waitForTimeout(1000) // wait for new design values to load on page
	const css_variables = await page.evaluate(() => {
		const styles = getComputedStyle(document.documentElement)
		return {
			primary_color: styles.getPropertyValue('--theme-primary-color').trim(),
			heading_font: styles.getPropertyValue('--theme-heading-font').trim(),
			body_font: styles.getPropertyValue('--theme-body-font').trim(),
			border_radius: styles.getPropertyValue('--theme-radius').trim()
		}
	})

	expect(css_variables.primary_color).toBe('#20bdbd')
	expect(css_variables.heading_font).toBe('Lato')
	expect(css_variables.body_font).toBe('Merriweather')
	expect(css_variables.border_radius).toBe('4px')
	await page.reload()
	expect(css_variables.primary_color).toBe('#20bdbd')
	expect(css_variables.heading_font).toBe('Lato')
	expect(css_variables.body_font).toBe('Merriweather')
	expect(css_variables.border_radius).toBe('4px')
})
