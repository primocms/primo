import { test, expect, type Page } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, loginAs, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth, ensureEditorUser, apiLoginAs } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite

// Editors can manage content and pages. Design source and role changes are
// enforced on the server, including direct API requests.
test.describe('Client permissions', () => {
	test.beforeAll(async ({ request }) => {
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'Permissions Fixture')
	})

	test('editor can make an allowed content edit', async ({ page, request }) => {
		const { token: devToken } = await devAuth(request)
		const editor = await ensureEditorUser(request, devToken, ids.siteId)

		await loginAs(page, editor.email, editor.password, ids.siteId)

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

	test('UI hides the developer-only page-type management control from an editor', async ({ page, browser, request }) => {
		const { token: devToken } = await devAuth(request)
		const editor = await ensureEditorUser(request, devToken, ids.siteId)

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
		await loginAs(editorPage, editor.email, editor.password, ids.siteId)
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
		const editor = await ensureEditorUser(request, devToken, ids.siteId)
		const editorToken = await apiLoginAs(request, editor.email, editor.password)
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
})
