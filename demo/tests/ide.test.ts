import { expect, test } from '@playwright/test';

test('Create component', async ({ page }) => {
  await page.goto('http://localhost:4173/blank');

  // Add Component to page
  await page.locator('button:has-text("Add Component")').click();

  // Create Component
  await page.locator('button:has-text("Create")').click();

  // Type HTML
  await page.locator('.codemirror-container.html [contenteditable=true]').click();
  await page.locator('.codemirror-container.html [contenteditable=true]').fill('<h1>{test}</h1>');

  // Type CSS
  await page.locator('.codemirror-container.css [contenteditable=true]').click();
  await page.locator('.codemirror-container.css [contenteditable=true]').fill('h1 {color:red}');

  // Click into Fields
  await page.locator('#tab-fields').click();

  // Add a Field
  await page.locator('text=Add a Field').click();

  // Type Label
  await page.locator('[placeholder="Heading"]').fill('Test');
  await page.locator('[placeholder="Heading"]').press('Tab');

  // Type ID
  await page.locator('[placeholder="heading"]').fill('test');
  await page.locator('[placeholder="heading"]').press('Tab');

  // Type default value
  await page.locator('[placeholder="Lorem ipsum"]').fill('TEST TEXT');

  // Draft
  await page.locator('button:has-text("Draft Component")').click();

  // Reopen Modal and add Component to Page (TODO: fix)
  await page.locator('button[aria-label="Close modal"]').click();
  await page.locator('button:has-text("Add Component")').click();
  await page.locator('.primary-action > button').click();

  // Expect Component on page
  await page.locator('.page h1:has-text("TEST TEXT")')
});