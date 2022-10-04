import { expect, test } from '@playwright/test';

test('user adds a new Site Library component from Primo Library', async ({ page }) => {
	// click Components
	// Go to http://localhost:5173/
	await page.goto('http://localhost:5173/');

	// Click [aria-label="Components"]
	await page.locator('[aria-label="Components"]').click();

	// Click button:has-text("Primo Library")
	await page.locator('button:has-text("Primo Library")').click();

	// Click text=Add to Site Library Teasers >> button
	await page.locator('text=Add to Site Library Teasers >> button').click();

	await page.locator('button:has-text("Site Library")').click();

	// Click .iframe-container
	await page.locator('.iframe-container').click();

	// click Primo Library
});
