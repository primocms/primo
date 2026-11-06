import { test, expect, type Page } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText, stubExternalImages } from './helpers/editor'
import { devAuth, ensureEditorUser } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite
let editorSession: { token: string; record: Record<string, unknown> }
async function loginAsEditor(page: Page, siteId: string) {
	await stubExternalImages(page)
	await page.addInitScript(session => localStorage.setItem('pocketbase_auth', JSON.stringify(session)), editorSession)
	await page.goto(`${TEST_SERVER_URL}/admin/sites/${siteId}`)
}

// Editors can manage content and pages. Design source and role changes are
// enforced on the server, including direct API requests.
test.describe('Client permissions', () => {
	test.beforeAll(async ({ request }) => {
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'Permissions Fixture')
		const editor = await ensureEditorUser(request, token, ids.siteId)
		// Reuse one real login across this permission matrix rather than
		// exhausting the server's login brute-force limit from one test IP.
		const auth = await request.post(`${TEST_SERVER_URL}/api/collections/users/auth-with-password`, {
			data: { identity: editor.email, password: editor.password }
		})
		expect(auth.ok()).toBeTruthy()
		editorSession = await auth.json()
	})

	test('editor can make an allowed content edit', async ({ page, request }) => {
		const { token: devToken } = await devAuth(request)

		await loginAsEditor(page, ids.siteId)

		const frame = canvasFrame(page)
		const headline = frame.locator('[data-testid="headline"]')
		await expect(headline).toBeVisible({ timeout: 15000 })

		const editorHeadline = `Editor Edit ${Date.now()}`
		await replaceContentEditableText(page, headline, editorHeadline)
		// Register the listener BEFORE blur(), which is what triggers the
		// save: waitForResponse only matches responses that arrive after
		// it starts listening, so registering it afterward can miss a fast
		// save and time out on content that was in fact persisted.
		const savePromise = page.waitForResponse(
			(res) => res.url().includes('/api/collections/page_section_entries/records/') && res.request().method() === 'PATCH',
			{ timeout: 5000 }
		)
		await headline.blur()
		const saveRes = await savePromise
		expect(saveRes.ok()).toBeTruthy()

		const entriesRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
			headers: { Authorization: `Bearer ${devToken}` },
			params: { filter: `section = "${ids.sectionId}"` }
		})
		const entries = (await entriesRes.json()).items
		const headlineEntry = entries.find((e: any) => e.field === ids.fieldIds.headline)
		expect(headlineEntry.value).toBe(editorHeadline)
	})

	test('UI hides the developer-only page-type management control from an editor', async ({ page, browser }) => {

		// Page Types moved out of the toolbar's developer-only "Page options"
		// dropdown into the Pages modal (#1250). The Pages button itself isn't
		// role-gated — SitePages.svelte renders the "Manage page types" button
		// only when Toolbar.svelte passes onManagePageTypes, which it supplies
		// for developers only. Assert on that affordance by test id: bits-ui
		// strips classes/aria from snippet children, so structural selectors
		// are unreliable here.
		const managePageTypesOn = (target: Page) => target.getByTestId('manage-page-types')

		// Confirm the control IS visible for a developer, to rule out a
		// selector mistake before asserting its absence for the editor.
		await loginAsDeveloper(page, ids.siteId)
		const devFrame = canvasFrame(page)
		await expect(devFrame.locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
		await page.getByRole('button', { name: 'Pages' }).click()
		await expect(managePageTypesOn(page)).toBeVisible({ timeout: 5000 })
		await page.keyboard.press('Escape')
		await expect(managePageTypesOn(page)).toBeHidden({ timeout: 5000 })

		// The editor session needs its own browser CONTEXT, not just its own
		// page. Two reasons, and a separate page only addresses the first:
		//   1. Both login helpers seed the auth token via addInitScript, and
		//      those registrations accumulate per page — reusing this page
		//      would leave the developer's and the editor's script both
		//      queued for the next navigation, with Playwright not defining
		//      which runs last.
		//   2. Pages in one context share localStorage for the origin, which
		//      is where pocketbase_auth lives. The developer session above is
		//      still open, so its client can write its own token back over
		//      the editor's after the editor page has booted. That raced:
		//      it passed locally and on the first CI run, then failed on a
		//      re-run with the developer's toolbar showing up here.
		// A fresh context gives the editor its own storage, the same way
		// content-persistence.spec.ts isolates its second session.
		const editorContext = await browser.newContext()
		const editorPage = await editorContext.newPage()
		await loginAsEditor(editorPage, ids.siteId)
		const editorFrame = canvasFrame(editorPage)
		await expect(editorFrame.locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
		// The Pages button is ordinary navigation — available to the editor.
		// The page-type control inside that modal is not.
		await editorPage.getByRole('button', { name: 'Pages' }).click()
		await expect(editorPage.getByRole('dialog')).toBeVisible({ timeout: 5000 })
		await expect(managePageTypesOn(editorPage)).toHaveCount(0)
		await editorContext.close()
	})

	test('server rejects direct page-type and block-code writes from an editor', async ({ request }) => {
		const { token: devToken } = await devAuth(request)
		const editorToken = editorSession.token
		const headers = { Authorization: `Bearer ${editorToken}` }
		const attemptedName = `Editor-created type ${Date.now()}`
		const create = await request.post(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
			headers, data: { site: ids.siteId, name: attemptedName }
		})
		expect(create.status()).toBe(403)
		const update = await request.patch(`${TEST_SERVER_URL}/api/collections/site_symbols/records/${ids.symbolId}`, {
			headers, data: { html: '<p>Forbidden source change</p>' }
		})
		expect(update.status()).toBe(403)
		const list = await request.get(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
			headers: { Authorization: `Bearer ${devToken}` }, params: { filter: `site = "${ids.siteId}" && name = "${attemptedName}"` }
		})
		expect(list.ok()).toBeTruthy()
		expect((await list.json()).items).toHaveLength(0)
		const block = await request.get(`${TEST_SERVER_URL}/api/collections/site_symbols/records/${ids.symbolId}`, {
			headers: { Authorization: `Bearer ${devToken}` }
		})
		expect(block.ok()).toBeTruthy()
		expect((await block.json()).html).not.toContain('Forbidden source change')
	})
	test('editor can create a static page with its prescribed template content', async ({ page, request }) => {
		const { token } = await devAuth(request)
		const seeded = await seedFixtureSite(token, 'Static editor creation')
		const headers = { Authorization: `Bearer ${token}` }
		const endpoint = (collection: string, id = '') => `${TEST_SERVER_URL}/api/collections/${collection}/records${id ? '/' + id : ''}`
		const homeRes = await request.get(endpoint('pages', seeded.pageId), { headers })
		expect(homeRes.ok()).toBeTruthy()
		const home = await homeRes.json()
		const availableRes = await request.get(endpoint('page_type_symbols'), { headers, params: { filter: `page_type = "${home.page_type}"` } })
		expect(availableRes.ok()).toBeTruthy()
		for (const record of (await availableRes.json()).items) {
			expect((await request.delete(endpoint('page_type_symbols', record.id), { headers })).ok()).toBeTruthy()
		}
		const sectionRes = await request.post(endpoint('page_type_sections'), { headers, data: { page_type: home.page_type, symbol: seeded.symbolId, zone: 'body', index: 0 } })
		expect(sectionRes.ok()).toBeTruthy()
		const section = await sectionRes.json()
		const entryRes = await request.post(endpoint('page_type_section_entries'), { headers, data: { section: section.id, field: seeded.fieldIds.headline, value: 'Static template heading', locale: 'en', index: 0 } })
		expect(entryRes.ok()).toBeTruthy()
		await ensureEditorUser(request, token, seeded.siteId)
		await loginAsEditor(page, seeded.siteId)
		await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		const dialog = page.getByRole('dialog')
		await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
		await dialog.getByLabel('Page name', { exact: true }).fill('Static Client Page')
		await dialog.locator('form').getByRole('button', { name: 'Create page', exact: true }).click()
		await expect(dialog.getByRole('link', { name: 'Static Client Page', exact: true })).toBeVisible()
		await expect(dialog.getByRole('alert')).toHaveCount(0)
		const pagesRes = await request.get(endpoint('pages'), { headers, params: { filter: `site = "${seeded.siteId}" && slug = "static-client-page"` } })
		expect(pagesRes.ok()).toBeTruthy()
		const pages = (await pagesRes.json()).items
		expect(pages).toHaveLength(1)
		const sectionsRes = await request.get(endpoint('page_sections'), { headers, params: { filter: `page = "${pages[0].id}"` } })
		expect(sectionsRes.ok()).toBeTruthy()
		const sections = (await sectionsRes.json()).items
		expect(sections).toHaveLength(1)
		expect(sections[0].symbol).toBe(seeded.symbolId)
		const valuesRes = await request.get(endpoint('page_section_entries'), { headers, params: { filter: `section = "${sections[0].id}" && field = "${seeded.fieldIds.headline}"` } })
		expect(valuesRes.ok()).toBeTruthy()
		expect((await valuesRes.json()).items[0].value).toBe('Static template heading')
	})

})
