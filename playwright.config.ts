import { defineConfig, type BrowserName } from '@playwright/test'
import { TEST_SERVER_URL } from './tests/e2e/helpers/paths'

const browserName = process.env.PRIMO_TEST_BROWSER || 'chromium'
if (!['chromium', 'firefox', 'webkit'].includes(browserName)) throw new Error('Unsupported test browser')

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.spec.ts',
	timeout: 30000,
	expect: { timeout: 10000 },
	globalSetup: './tests/e2e/global-setup.ts',
	globalTeardown: './tests/e2e/global-teardown.ts',
	use: {
		baseURL: TEST_SERVER_URL,
		browserName: browserName as BrowserName,
		// Firefox's headless capture path intermittently crashes its content
		// process during redirects (SWGL/VideoFrame errors). Keep DOM/network
		// traces and failure screenshots, without continuous screen capture.
		trace: browserName === 'firefox'
			? { mode: 'retain-on-failure', screenshots: false, snapshots: { dom: true, aria: true, screen: false }, sources: true }
			: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
})
