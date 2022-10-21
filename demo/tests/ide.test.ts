import { expect, test } from '@playwright/test';

test('Create component with field', async ({ page }) => {
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


test('Update site CSS', async ({ page }) => {
  await page.goto('http://localhost:4173/landing-page');

  // Slow down to prevent creating page before site has loaded 
  await page.locator('#primo-toolbar-overlay div:has-text("Landing Page")')
  await page.waitForTimeout(5000)

  // Switch to IDE
  await page.locator('#ide').click();

  // Click [aria-label="CSS"]
  await page.locator('[aria-label="CSS"]').click();

  // Click button:has-text("Site")
  await page.locator('button:has-text("Site")').click();

  // Click text=--color-accent: rebeccapurple; >> span >> nth=2
  await page.locator('text=--color-accent: rebeccapurple; >> span').nth(2).click();

  await Promise.all('rebeccapurple'.split('').map(async () => {
    await page.keyboard.press('Backspace')
  }))

  await page.keyboard.type('rgb(255, 0, 0)');

  // Click button:has-text("Draft")
  await page.locator('button:has-text("Draft")').click();

  await page.waitForTimeout(1000)

  await expect(await page.$eval('.section#clmrm .buttons .button:first-child', e => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 0, 0)');

})

test('Update site HTML', async ({ page }) => {

  // Click #ide
  // Go to http://localhost:4173/blank
  await page.goto('http://localhost:4173/blank');

  // Click #ide
  await page.locator('#ide').click();

  // Click [aria-label="HTML"]
  await page.locator('[aria-label="HTML"]').click();

  // Click button:has-text("Site")
  await page.locator('button:has-text("Site")').click();

  // Click text=/.*<meta charset="UTF-8"\>.*/
  await page.locator('text=/.*<meta charset="UTF-8"\\>.*/').click();

  await page.locator('text=/.*<meta charset="UTF-8"\\>.*/').type('<link id="test-head" />');

  // Press ArrowRight
  await page.locator('text=/.*<meta name="viewport" content="width=device-width, initial-scale=1\\.0"\\> <meta cha.*/').press('ArrowRight');

  // Click button:has-text("Draft")
  await page.locator('button:has-text("Draft")').click();

  await page.locator('#test-head')
})