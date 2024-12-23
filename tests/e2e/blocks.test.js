import { test, expect } from '@playwright/test'

test('Create static section', async ({ page }) => {
	await page.goto('/1/page-type--1')

	// Get the source and target elements
	const sourceElement = page.locator('[data-test-id="symbol-2"]')
	const targetElement = page.locator('[data-test-id="page-type-section-1"]')

	// Ensure both elements are visible before proceeding
	await sourceElement.waitFor({ state: 'visible' })
	await targetElement.waitFor({ state: 'visible' })

	// Get the bounding boxes of the elements
	const sourceBox = await sourceElement.boundingBox()
	const targetBox = await targetElement.boundingBox()

	if (!sourceBox || !targetBox) {
		throw new Error('Unable to get bounding boxes. Are the elements visible?')
	}

	// Calculate start and end positions
	const startX = sourceBox.x + sourceBox.width / 2
	const startY = sourceBox.y + sourceBox.height / 2
	const endX = targetBox.x + targetBox.width / 2
	const endY = targetBox.y + targetBox.height / 2

	// Perform the drag and drop
	await page.mouse.move(startX, startY)
	await page.mouse.down()
	await page.mouse.move(endX, endY, { steps: 10 }) // Move in steps for smoother drag
	await page.mouse.up()

	// Wait for any animations or state updates to complete
	await page.waitForTimeout(500)

	// Verify the result (adjust this based on how your app indicates a successful drop)
	// For example, you might check if the source element is now a child of the target element
	const droppedElement = page.locator('[data-block="2"]')
	await expect(droppedElement).toBeVisible()

	await page.goto('/1')
	await expect(page.locator('[data-block="2"]')).toBeVisible()
})

test('Create palette section', async ({ page }) => {
	await page.goto('/1')

	// Get the source and target elements
	const sourceElement = page.locator('[data-test-id="symbol-2"]')
	const targetElement = page.locator('.is-palette')

	// Ensure both elements are visible before proceeding
	await sourceElement.waitFor({ state: 'visible' })
	await targetElement.waitFor({ state: 'visible' })

	// Get the bounding boxes of the elements
	const sourceBox = await sourceElement.boundingBox()
	const targetBox = await targetElement.boundingBox()

	if (!sourceBox || !targetBox) {
		throw new Error('Unable to get bounding boxes. Are the elements visible?')
	}

	// Calculate start and end positions
	const startX = sourceBox.x + sourceBox.width / 2
	const startY = sourceBox.y + sourceBox.height / 2
	const endX = targetBox.x + targetBox.width / 2
	const endY = targetBox.y + targetBox.height / 2

	// Perform the drag and drop
	await page.mouse.move(startX, startY)
	await page.mouse.down()
	await page.mouse.move(endX, endY, { steps: 10 }) // Move in steps for smoother drag
	await page.mouse.up()

	// Wait for any animations or state updates to complete
	await page.waitForTimeout(500)

	// Verify the result (adjust this based on how your app indicates a successful drop)
	// For example, you might check if the source element is now a child of the target element
	const droppedElement = page.locator('.is-palette [data-block="2"]')
	await expect(droppedElement).toBeVisible()

	await page.reload()
	await expect(page.locator('.is-palette [data-block="2"]')).toBeVisible()
})
