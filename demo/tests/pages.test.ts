import { expect, test } from '@playwright/test';

// Shows correct active page in list

// Rename page

// Change page name & id

// Delete page

// Create child page

// Rename child page & id

// Delete child page

// Navigate back to parent page

// Create page from scratch

test('Create and navigate to new page', async ({ page }) => {

  // Go to http://localhost:4173/
  await page.goto('http://localhost:4173/site');

  // Click button:has-text("Add Content")
  await page.locator('button:has-text("Add Content")').click();

  // Click [aria-label="Pages"]
  await page.locator('[aria-label="Pages"]').click();

  // Click button:has-text("Create Page")
  await page.locator('button:has-text("Create Page")').click();

  // Click [placeholder="About Us"]
  await page.locator('[placeholder="About Us"]').click();

  // Fill [placeholder="About Us"]
  await page.locator('[placeholder="About Us"]').fill('Secondary Page');

  // Create Page
  await page.locator('text=Create').click();

  // Navigate to page
  await page.locator('a').nth(4).click();
  await expect(page).toHaveURL('http://localhost:4173/site/secondary-page');
});