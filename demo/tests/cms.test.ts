import { expect, test } from '@playwright/test';

test('Adding a new Site Library component from Primo Library', async ({ page }) => {
  await page.goto('http://localhost:4173/');

  // Switch to IDE
  await page.locator('.switch').click();

  // Click Components
  await page.locator('[aria-label="Components"]').click();

  // Click Primo Library
  await page.locator('.tabs button:has-text("Primo Library")').click();

  // Add 'Teasers' to Site Library
  await page.locator('text=Add to Site Library Teasers >> button').click();

  // Click Site Library
  await page.locator('.tabs button:has-text("Site Library")').click();

  // Add 'Teasers' to page (TODO: fix workaround)
  await page.locator('button[aria-label="Close modal"]').click();
  await page.locator('button:has-text("Add Component")').click();
  await page.locator('.primary-action > button').click();

});

test('Writes page content', async ({ page }) => {
  await page.goto('http://localhost:4173/');

  // Click button:has-text("Add Content")
  await page.locator('button:has-text("Add Content")').click();

  const content_node = page.locator('.ProseMirror.primo-content')

  // H1
  await content_node.type('# This is an h1')
  await content_node.press('Enter');
  await expect(page.locator('.primo-content h1')).toHaveText('This is an h1');

  // H2
  await content_node.type('## This is an h2')
  await content_node.press('Enter');
  await expect(page.locator('.primo-content h2')).toHaveText('This is an h2');

  // Unordered List Item
  await content_node.type('- This is an unordered list item')
  await content_node.press('Enter');
  await content_node.press('Enter');
  await expect(page.locator('.primo-content ul li p')).toHaveText('This is an unordered list item');

  // Ordered List Item
  await content_node.type('1. This is an ordered list item')
  await content_node.press('Enter');
  await content_node.press('Enter');
  await expect(page.locator('.primo-content ol li p')).toHaveText('This is an ordered list item');

});


test('Creates elements with UI', async ({ page }) => {
  await page.goto('http://localhost:4173/');
  await page.locator('button:has-text("Add Content")').click();

  const content_node = page.locator('.ProseMirror.primo-content')

  // Heading
  await page.locator('[data-tippy-root] .menu button:nth-child(1)').click();
  await content_node.type('This is an h1')
  await content_node.press('Enter');
  await expect(page.locator('.primo-content h1')).toHaveText('This is an h1');

  // Code
  await page.locator('[data-tippy-root] .menu button:nth-child(2)').click();
  await content_node.type('This is a code block')
  await content_node.press('Enter');
  await content_node.press('Enter');
  await content_node.press('Enter');
  await expect(page.locator('.primo-content code')).toHaveText('This is a code block');

  // Quote
  await page.locator('[data-tippy-root] .menu button:nth-child(3)').click();
  await content_node.type('This is a quote')
  await content_node.press('Enter');
  await content_node.press('Enter');
  await content_node.press('Enter');
  await expect(page.locator('.primo-content blockquote p')).toHaveText('This is a quote');

  // Unordered List
  await page.locator('[data-tippy-root] .menu button:nth-child(4)').click();
  await content_node.type('This is an unordered list')
  await content_node.press('Enter');
  await content_node.press('Enter');
  await content_node.press('Enter');
  await expect(page.locator('.primo-content ul li p')).toHaveText('This is an unordered list');

  // Ordered List
  await page.locator('[data-tippy-root] .menu button:nth-child(5)').click();
  await content_node.type('This is an ordered list')
  await content_node.press('Enter');
  await content_node.press('Enter');
  await content_node.press('Enter');
  await expect(page.locator('.primo-content ol li p')).toHaveText('This is an ordered list');

  // Image
  await page.locator('[data-tippy-root] .menu button:nth-child(6)').click();
  await page.locator('.image-input input[type="url"]').type('https://images.unsplash.com/photo-1664434341235-f77a94e1a26c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80')
  await page.locator('.primary-button').click()
  await expect(page.locator('.primo-content img')).toHaveAttribute('src', 'https://images.unsplash.com/photo-1664434341235-f77a94e1a26c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2070&q=80');
})