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

test('Create and navigate to empty page', async ({ page }) => {
  const theme = 'landing-page'
  await page.goto(`http://localhost:4173/${theme}`);

  // Slow down to prevent creating page before site has loaded 
  await page.locator('.section.has-component')

  // Click 'Pages'
  await page.locator('[aria-label="Pages"]').click();

  // Click 'Create Page'
  await page.locator('button:has-text("Create Page")').click();

  // Give site name (url auto-fills)
  await page.locator('[placeholder="About Us"]').click();
  await page.locator('[placeholder="About Us"]').fill('Second Page');

  // Uncheck 'Duplicate'
  await page.locator('text=Duplicate active page').click();

  // Click Create
  await page.locator('text=Create').click();

  // Expect new page list item
  await expect(page.locator('.page-items [data-page-i="1"] .title')).toHaveText('Second Page');

  // Navigate to page
  await page.locator('[data-page-i="1"] a.page-link').click();
  await expect(page).toHaveURL(`http://localhost:4173/${theme}/second-page`);

});

test('Delete page', async ({ page }) => {
  await page.goto(`http://localhost:4173/landing-page`);

  // Click 'Pages'
  await page.locator('[aria-label="Pages"]').click();

  // Delete Page
  await page.locator('.page-items [data-page-i="2"] button.delete').click();

  // Close Modal
  await page.locator('[aria-label="Close modal"]').click();
});

test('Create and navigate to duplicated page', async ({ page }) => {
  const theme = 'landing-page'
  // Go to Landing Page
  await page.goto(`http://localhost:4173/${theme}`);

  // Click 'Pages'
  await page.locator('[aria-label="Pages"]').click();

  // Click 'Create Page'
  await page.locator('button:has-text("Create Page")').click();

  // Add page name (url is automatic)
  await page.locator('[placeholder="About Us"]').click();
  await page.locator('[placeholder="About Us"]').fill('Secondary Page');

  // Click 'Create'
  await page.locator('text=Create').click();

  // Navigate to page
  await page.locator('a').nth(4).click();
  await expect(page).toHaveURL(`http://localhost:4173/${theme}/secondary-page`);
});