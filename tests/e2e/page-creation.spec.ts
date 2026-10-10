import { test, expect } from '@playwright/test'
import { loginAsDeveloper, canvasFrame } from './helpers/editor'
import { devAuth, SERVER_URL } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

test.describe('Pages creation row', () => {
	for (const overflow of [false, true]) {
		test(`replaces one visible loading row in a ${overflow ? 'scrolling' : 'short'} list`, async ({ page, request }) => {
			const { token } = await devAuth(request)
			const ids = await seedFixtureSite(token, `Page Creation ${overflow}`)
			const headers = { Authorization: `Bearer ${token}` }
			async function create(collection: string, data: Record<string, unknown>) {
				const response = await request.post(`${SERVER_URL}/api/collections/${collection}/records`, { headers, data })
				expect(response.ok(), await response.text()).toBeTruthy()
				return response.json()
			}
			async function list(collection: string, filter: string) {
				const response = await request.get(`${SERVER_URL}/api/collections/${collection}/records`, { headers, params: { filter } })
				expect(response.ok()).toBeTruthy()
				return (await response.json()).items
			}
			const home = await (await request.get(`${SERVER_URL}/api/collections/pages/records/${ids.pageId}`, { headers })).json()
			await create('page_types', { site: ids.siteId, name: 'Other', icon: 'mdi:file-document-outline', color: '#ffffff' })
			const field = await create('page_type_fields', { page_type: home.page_type, type: 'text', key: 'title', label: 'Title', index: 0 })
			await create('page_type_entries', { field: field.id, locale: 'en', index: 0, value: 'Template title' })
			const section = await create('page_type_sections', { page_type: home.page_type, symbol: ids.symbolId, index: 0, zone: 'body' })
			await create('page_type_section_entries', { section: section.id, field: ids.fieldIds.headline, locale: 'en', index: 0, value: 'Template headline' })
			if (overflow) {
				for (let index = 0; index < 18; index++) {
					await create('pages', { site: ids.siteId, parent: ids.pageId, page_type: home.page_type, name: `Existing ${index}`, slug: `existing-${index}`, index })
				}
			}

			await loginAsDeveloper(page, ids.siteId)
			await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
			await page.getByRole('button', { name: 'Pages', exact: true }).click()
			const dialog = page.getByRole('dialog')
			const pageList = dialog.locator('ul.page-list').first()
			await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
			const pageTypeSelect = dialog.locator('.Select', { hasText: 'Page Type' })
			await pageTypeSelect.locator('button.primary').click()
			await pageTypeSelect.locator('.popup .options button', { hasText: 'Default' }).click()
			await dialog.getByPlaceholder('About Us').fill('New Page')
			const before = (await dialog.boundingBox())!
			if (overflow) await pageList.evaluate((node) => (node.scrollTop = 0))
			const initialScroll = await pageList.evaluate((node) => node.scrollTop)

			let releasePage!: () => void
			let releaseEntries!: () => void
			const pageGate = new Promise<void>((resolve) => (releasePage = resolve))
			const entriesGate = new Promise<void>((resolve) => (releaseEntries = resolve))
			await page.route('**/api/collections/pages/records', async (route) => {
				if (route.request().method() === 'POST') await pageGate
				await route.continue()
			})
			await page.route('**/api/collections/page_section_entries/records', async (route) => {
				if (route.request().method() === 'POST') await entriesGate
				await route.continue()
			})
			// Submit from the focused name input without auto-scrolling the form
			// back into view; creation must reveal its row in the list itself.
			await page.keyboard.press('Enter')
			const loading = dialog.getByRole('status')
			try {
				await expect(loading).toHaveCount(1)
				await expect(loading).toHaveText('Creating New Page…')
				await expect(dialog.getByRole('link', { name: 'New Page', exact: true })).toHaveCount(0)
				await expect(dialog.locator('form')).toBeHidden()
				const row = loading.locator('..')
				const rowIndex = await row.evaluate((node) => [...node.parentElement!.children].indexOf(node))
				await row.evaluate((node) => node.setAttribute('data-creation-row', 'true'))
				await expect
					.poll(async () => {
						const listBox = (await pageList.boundingBox())!
						const rowBox = (await row.boundingBox())!
						return rowBox.y >= listBox.y + 4 && rowBox.y + rowBox.height <= listBox.y + listBox.height - 4
					})
					.toBe(true)
				if (overflow) expect(await pageList.evaluate((node) => node.scrollTop)).toBeGreaterThan(initialScroll)
				expect((await dialog.boundingBox())!.y).toBeCloseTo(before.y, 1)
				expect((await dialog.boundingBox())!.height).toBeCloseTo(before.height, 1)

				const entriesRequest = page.waitForRequest((req) => req.method() === 'POST' && req.url().includes('/api/collections/page_section_entries/records'))
				releasePage()
				await entriesRequest
				// The page record has saved, but its copied content is still saving.
				await expect(loading).toHaveText('Creating New Page…')
				await expect(dialog.getByRole('link', { name: 'New Page', exact: true })).toHaveCount(0)
				releaseEntries()
				await expect(loading).toHaveCount(0)
				const completed = dialog.getByRole('link', { name: 'New Page', exact: true })
				await expect(completed).toHaveCount(1)
				await expect(dialog.locator('[data-creation-row="true"]')).toContainText('New Page')
				expect(await completed.locator('xpath=ancestor::li[1]').evaluate((node) => [...node.parentElement!.children].indexOf(node))).toBe(rowIndex)
				expect((await dialog.boundingBox())!.y).toBeCloseTo(before.y, 1)
				expect((await dialog.boundingBox())!.height).toBeCloseTo(before.height, 1)

				const [created] = await list('pages', `site = "${ids.siteId}" && slug = "new-page"`)
				const [copiedEntry] = await list('page_entries', `page = "${created.id}"`)
				expect(copiedEntry.value).toBe('Template title')
				const [copiedSection] = await list('page_sections', `page = "${created.id}"`)
				expect(copiedSection.symbol).toBe(ids.symbolId)
				const [copiedSectionEntry] = await list('page_section_entries', `section = "${copiedSection.id}"`)
				expect(copiedSectionEntry.value).toBe('Template headline')

				if (!overflow) {
					await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
					await dialog.getByPlaceholder('About Us').fill('New Page')
					await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
					await expect(dialog.getByRole('alert')).toHaveText('That URL is already in use')
					await expect(dialog.getByPlaceholder('About Us')).toHaveValue('New Page')
					await expect(loading).toHaveCount(0)
					await expect(completed).toHaveCount(1)

					const rejectCreation = (route: import('@playwright/test').Route) =>
						route.request().method() === 'POST' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Creation failed', data: {} }) }) : route.continue()
					await page.route('**/api/collections/pages/records', rejectCreation)
					await dialog.getByPlaceholder('About Us').fill('Failed Page')
					await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
					await expect(dialog.getByRole('alert')).toContainText('Creation failed')
					await expect(dialog.getByPlaceholder('About Us')).toHaveValue('Failed Page')
					await expect(dialog.getByRole('button', { name: 'Create page', exact: true })).toBeEnabled()
					await expect(loading).toHaveCount(0)
					await expect(dialog.getByRole('link', { name: 'Failed Page', exact: true })).toHaveCount(0)
					await page.unroute('**/api/collections/pages/records', rejectCreation)
					await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
					await expect(dialog.getByRole('link', { name: 'Failed Page', exact: true })).toHaveCount(1)
					await expect(dialog.getByRole('alert')).toHaveCount(0)
				}
				if (overflow) {
					const parentRow = completed.locator('xpath=ancestor::li[1]')
					await parentRow.getByRole('button', { name: 'Options for New Page', exact: true }).click()
					await page.getByRole('menuitem', { name: 'Create Subpage', exact: true }).click()
					await dialog.getByLabel('Page name', { exact: true }).fill('Nested Page')
					const beforeChild = (await dialog.boundingBox())!
					let releaseChild!: () => void
					const childGate = new Promise<void>((resolve) => (releaseChild = resolve))
					await page.route('**/api/collections/pages/records', async (route) => {
						if (route.request().method() === 'POST') await childGate
						await route.continue()
					})
					try {
						await pageList.evaluate((node) => (node.scrollTop = 0))
						await page.keyboard.press('Enter')
						await expect(loading).toHaveCount(1)
						await expect(loading).toHaveText('Creating Nested Page…')
						await expect(dialog.getByRole('link', { name: 'Nested Page', exact: true })).toHaveCount(0)
						await loading.locator('..').evaluate((node) => node.setAttribute('data-nested-creation-row', 'true'))
						await expect
							.poll(async () => {
								const listBox = (await pageList.boundingBox())!
								const rowBox = (await loading.boundingBox())!
								return rowBox.y >= listBox.y + 4 && rowBox.y + rowBox.height <= listBox.y + listBox.height - 4
							})
							.toBe(true)
						releaseChild()
						await expect(loading).toHaveCount(0)
						await expect(dialog.locator('[data-nested-creation-row="true"]')).toContainText('Nested Page')
						expect((await dialog.boundingBox())!.y).toBeCloseTo(beforeChild.y, 1)
						expect((await dialog.boundingBox())!.height).toBeCloseTo(beforeChild.height, 1)
					} finally {
						releaseChild()
					}
				}
			} finally {
				releasePage()
				releaseEntries()
			}
		})
	}
})
