import { defineConfig } from '@playwright/test'
import { TEST_SERVER_URL } from './tests/e2e/helpers/paths'

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.spec.ts',
	timeout: 30000,
	expect: { timeout: 10000 },
	globalSetup: './tests/e2e/global-setup.ts',
	globalTeardown: './tests/e2e/global-teardown.ts',
	use: {
		baseURL: TEST_SERVER_URL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
})
