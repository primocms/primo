import { chromium } from '@playwright/test'
import fs from 'fs'
import { expect } from '@playwright/test'

async function global_setup() {
	const auth_file = 'playwright/.auth/user.json'

	let needAuth = true

	if (fs.existsSync(auth_file)) {
		// Try to use existing auth data
		const browser = await chromium.launch({ headless: false })
		const context = await browser.newContext({ storageState: auth_file })
		const page = await context.newPage()

		try {
			// Navigate to a protected page
			await page.goto('http://localhost:5173/1')
			await page.waitForTimeout(10000) // Wait for 2 seconds

			// Check if we're still on the dashboard (i.e., not redirected to login)
			if (page.url().includes('/1')) {
				console.log('Existing auth is valid, skipping authentication')
				needAuth = false
			} else {
				console.log('Existing auth is invalid or expired')
			}
		} catch (error) {
			console.log('Error checking auth status:', error)
		}

		await browser.close()
	}

	if (needAuth) {
		console.log('Performing authentication...')
		const browser = await chromium.launch({ headless: false })
		const page = await browser.newPage()
		await page.goto('http://localhost:5173/auth')

		// Perform authentication
		await page.fill('[data-test-id="email"]', import.meta.env.PLAWRIGHT_AUTH_EMAIL)
		await page.fill('[data-test-id="password"]', import.meta.env.PLAYWRIGHT_AUTH_PASSWORD)
		await page.click('[data-test-id="submit"]')

		// Wait for authentication to complete
		await expect(page.locator('.sites-container')).toBeVisible()
		await page.waitForTimeout(2000) // Wait for 2 seconds

		// Save authentication state
		await page.context().storageState({ path: 'playwright/.auth/user.json' })

		await browser.close()
		console.log('Authentication completed and state saved')
	}
}

export default global_setup
