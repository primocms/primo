import { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
	use: {
		launchOptions: {
			headless: false
		},
		storageState: './playwright/.auth/user.json',
		baseURL: 'http://localhost:5173' // Adjust this to your app's URL
	},
	testDir: './tests/e2e',
	timeout: 30000,
	globalSetup: './playwright/global-setup.js'
}

export default config
