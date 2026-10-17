import { defineConfig } from '@playwright/test'
import { TEST_SERVER_URL } from '../e2e/helpers/paths'

// Adversarial blocked-frame documents run in a separate browser/process/data
// lifetime. Normal builder workflows still run completely in all three engines.
export default defineConfig({
 testDir: '.', testMatch: '**/*.spec.ts', workers: 1, retries: 0, timeout: 30000,
 globalSetup: '../e2e/global-setup.ts', globalTeardown: '../e2e/global-teardown.ts',
 use: { baseURL: TEST_SERVER_URL, browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
 reporter: [['list']]
})
