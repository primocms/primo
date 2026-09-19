import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloperAtDashboard, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

interface BuiltUpTo4 {
	newSiteId: string
	newSymbol: { id: string }
	newPage: { id: string; slug?: string }
	devToken: string
}

/**
 * Steps 1-4 of the "developer builds a site" happy path, through the real
 * UI only: create site -> create page type -> create a block with a text
 * field -> toggle the block on for the page type (this is what makes a
 * page type "dynamic" per PageType_Sidebar.svelte — there is no separate
 * static/dynamic flag) -> create a page of that type. No API mutations
 * anywhere in this function — only API reads/waits to observe the result
 * of a UI action that already happened.
 *
 * Shared by both the strict UI-only drag test and the API-assisted
 * publish-flow test below, so the (large, thoroughly-commented) setup
 * doesn't need to be duplicated or re-verified twice.
 */
async function buildSiteThroughPageCreation(page: Page, request: APIRequestContext): Promise<BuiltUpTo4> {
	const { token: devToken } = await devAuth(request)
	// One-time seed: Create Site requires selecting an existing site as a
	// starter (no blank-site option in the wizard) — this is setup, not a
	// shortcut around the flow under test.
	await seedFixtureSite(devToken, 'Starter For Clone')

	await loginAsDeveloperAtDashboard(page)
	// The dev-mode indicator badge (devmode.go's injected script) floats
	// to a fixed position when no toolbar slot is present — as it isn't
	// during the full-screen CreateSite wizard — and can end up
	// overlapping wizard buttons, causing intermittent click failures.
	// It's debug-only tooling, not part of the flow under test; hide it
	// for the whole test rather than special-casing every click near it.
	await page.addStyleTag({ content: '#__primo_dev_indicator__ { display: none !important; }' })

	// --- 1. Create Site ---
	await page.getByRole('button', { name: 'Create Site' }).click()
	const newSiteName = `Built Site ${Date.now()}`
	await page.getByLabel('Site Name').fill(newSiteName)
	await page.getByRole('button', { name: 'Next' }).click()

	// Starter step: pick the seeded starter site.
	await page.getByRole('tab', { name: 'Sites' }).click()
	await page.getByRole('button').filter({ hasText: 'Starter For Clone' }).first().click()
	await page.getByRole('button', { name: 'Next' }).click()

	// Blocks step: optional, skip straight to create.
	const cloneResponsePromise = page.waitForResponse(
		(res) => res.url().includes('/api/primo/clone-site') && res.request().method() === 'POST',
		{ timeout: 15000 }
	)
	await page.getByRole('button', { name: 'Done' }).click()
	const cloneRes = await cloneResponsePromise
	expect(cloneRes.ok()).toBeTruthy()
	const { id: newSiteId } = await cloneRes.json()
	expect(newSiteId).toBeTruthy()

	// Wizard closes back to the dashboard (no auto-navigation into the
	// site) — wait for the new site's card, then enter its editor.
	// Two links match this name: an icon-only "Open {name}" link and the
	// visible title text link — target the exact-text one.
	const siteCardLink = page.getByRole('link', { name: newSiteName, exact: true })
	await expect(siteCardLink).toBeVisible({ timeout: 15000 })
	await siteCardLink.click()
	await expect(page).toHaveURL(new RegExp(`/admin/sites/${newSiteId}`), { timeout: 15000 })

	// --- 2. Create Page Type ---
	await page.getByRole('button', { name: 'Page options' }).click()
	await page.getByRole('menuitem', { name: 'Page Types' }).click()
	const pageTypesDialog = page.getByRole('dialog')
	await expect(pageTypesDialog).toBeVisible()
	await pageTypesDialog.getByRole('button', { name: 'Create Page Type' }).click()

	const pageTypeName = `Landing Page ${Date.now()}`
	const pageTypeCreateResponsePromise = page.waitForResponse(
		(res) => res.url().includes('/api/collections/page_types/records') && res.request().method() === 'POST',
		{ timeout: 10000 }
	)
	await pageTypesDialog.getByPlaceholder('Post').fill(pageTypeName)
	await pageTypesDialog.locator('button.save').click()
	const pageTypeCreateRes = await pageTypeCreateResponsePromise
	expect(pageTypeCreateRes.ok()).toBeTruthy()
	const newPageType = await pageTypeCreateRes.json()

	// Navigate into the new page type's editor to add a block to it, via
	// the in-app link (not page.goto()) — a hard navigation to this route
	// was observed to leave the block-field editor's Key-from-Label
	// auto-derivation silently inert (Key field stayed empty no matter
	// how long we waited), while the same sequence reached via normal
	// SvelteKit client-side routing worked immediately every time. Not
	// pursued further since a real developer would always arrive here by
	// clicking, never by hard-loading this URL — but worth a note for
	// whoever next touches this modal's mount/init order.
	await pageTypesDialog.getByRole('link', { name: pageTypeName }).click()
	await expect(page).toHaveURL(new RegExp(`page-type--${newPageType.id}`), { timeout: 15000 })
	// The dialog's bits-ui portal can linger mounted across this
	// client-side route change; make sure it's actually gone so a later
	// unscoped getByRole('dialog') call (for the Pages dialog) can't
	// resolve ambiguously against a stale one.
	await expect(pageTypesDialog).toBeHidden({ timeout: 5000 })

	// --- 3. Create a Block with a text field ---
	// A new block has no name field in this modal (BlockEditor.svelte has
	// no name input at all — the dialog title falls back to "Block" until
	// renamed via a separate action elsewhere) — it stays permanently
	// nameless unless explicitly renamed, which isn't part of this flow.
	//
	// Opening the dialog creates the block only in the local reactive
	// store (SiteSymbols.create in BlockEditor.svelte's new_block(),
	// called synchronously on mount) — no network request fires yet.
	// Every edit (html/css/js, and the field create below) merges into
	// that same still-uncommitted local record (CollectionMapping.svelte.ts's
	// update() folds into a pending 'create' rather than emitting a
	// separate one) — so the FIRST time this record ever reaches the
	// server is a single POST, on clicking "Create Block", carrying the
	// final merged state. That's the only network call to wait on here.
	const blocksSidebar = page.locator('.sidebar')
	await blocksSidebar.getByRole('button', { name: 'Create', exact: true }).click()
	const blockDialog = page.getByRole('dialog')
	await expect(blockDialog).toBeVisible()

	// Content tab FIRST: the field must exist before code can reference it
	// as a bare identifier, or the component fails to compile (has_error
	// stays true, permanently disabling "Create Block") — confirmed by
	// direct repro: typing `{headline}` before the field exists leaves
	// Create Block disabled indefinitely; creating the field first, then
	// referencing it, compiles immediately.
	await page.keyboard.press('ControlOrMeta+E')
	await blockDialog.getByRole('button', { name: 'Create Field' }).click()
	await page.waitForTimeout(300)
	// Two placeholders collide case-insensitively ("Heading" for Label,
	// "heading" for the auto-derived Key) — Playwright's getByPlaceholder
	// is exact-string but case-sensitive is still ambiguous unless pinned.
	const labelInput = blockDialog.getByPlaceholder('Heading', { exact: true })
	const keyInput = blockDialog.getByPlaceholder('heading', { exact: true })
	await labelInput.fill('Headline')
	// The Key field is meant to auto-derive from Label (FieldItem.svelte's
	// oninput handler calls validate_field_key on every Label change),
	// but this was observed to intermittently leave Key empty, and to
	// asynchronously derive AFTER a same-tick fallback fill() (producing
	// "headlineheadline" — the derivation firing just after our fill,
	// appending rather than overwriting) — a genuine race with no fixed
	// ordering, not tied to any one code path. toPass retries the whole
	// read-and-maybe-fix cycle until it lands on the correct value,
	// rather than assuming one fallback attempt is enough.
	await expect(async () => {
		const current = await keyInput.inputValue()
		if (current !== 'headline') {
			await keyInput.fill('headline')
		}
		await expect(keyInput).toHaveValue('headline', { timeout: 500 })
	}).toPass({ timeout: 8000 })

	// Back to the code tab: write the component referencing the field.
	await page.keyboard.press('ControlOrMeta+E')
	const codeArea = blockDialog.locator('.cm-content').first()
	await expect(codeArea).toBeVisible({ timeout: 5000 })
	// The new page's section starts with no content entries until step 5
	// (or its API-seeded equivalent) fills one in, so this field renders
	// empty until edited — give the tag a min-height so an empty <h1>
	// still has a non-zero bounding box Playwright will consider
	// clickable/visible.
	const componentCode = '<h1 data-testid="built-headline" style="min-height: 1.5em; display: block;">{headline}</h1>'
	await codeArea.click()
	// CodeMirror's HTML mode auto-closes tags as they're typed, so
	// simulating real keystrokes for a full open+close tag mangles the
	// result (observed: "...{headline}</h1>h1>" — a duplicate/partial
	// close tag, from the editor's own auto-inserted close tag colliding
	// with ours). insertText() sets the content directly without
	// simulating individual keystrokes, sidestepping that heuristic
	// entirely.
	await page.keyboard.insertText(componentCode)
	await expect(codeArea).toHaveText(componentCode, { timeout: 2000 })
	await expect(blockDialog.getByRole('button', { name: 'Create Block' })).toBeEnabled({ timeout: 5000 })

	const blockSaveResponsePromise = page.waitForResponse(
		(res) => res.url().includes('/api/collections/site_symbols/records') && res.request().method() === 'POST',
		{ timeout: 10000 }
	)
	await blockDialog.getByRole('button', { name: 'Create Block' }).click()
	const blockSaveRes = await blockSaveResponsePromise
	// Check the mutation itself before parsing it. A failed create would
	// otherwise surface as the symbol locator below timing out, which
	// reads like a UI regression instead of "block creation returned an
	// error."
	expect(blockSaveRes.ok(), `block creation failed: ${blockSaveRes.status()}`).toBeTruthy()
	const newSymbol = await blockSaveRes.json()
	expect(newSymbol?.id, 'block creation returned no record id').toBeTruthy()
	await expect(blockDialog).toBeHidden({ timeout: 5000 })

	// --- toggle the new block on for this page type (this is what makes
	// the page type "dynamic" instead of static — PageType_Sidebar.svelte) ---
	const blockToggleResponsePromise = page.waitForResponse(
		(res) => res.url().includes('/api/collections/page_type_symbols/records') && res.request().method() === 'POST',
		{ timeout: 10000 }
	)
	const blockRow = page.locator('.sidebar-symbol').filter({ has: page.locator(`[data-test-id="symbol-${newSymbol.id}"]`) })
	await blockRow.getByRole('switch', { name: 'Toggle Symbol for Page Type' }).click()
	await blockToggleResponsePromise

	// --- 4. Create a Page of this type ---
	await page.getByRole('button', { name: 'Pages' }).click()
	const pagesDialog = page.getByRole('dialog')
	await expect(pagesDialog).toBeVisible()
	await pagesDialog.getByRole('button', { name: 'Create Page' }).click()

	const pageName = `Landing ${Date.now()}`
	await pagesDialog.getByPlaceholder('About Us').fill(pageName)

	// Explicitly select the page type we just created — PageForm.svelte
	// only renders this selector when 2+ page types exist (true here,
	// since the cloned starter already had its own "Default" type) and
	// otherwise defaults to some other existing type, which would create
	// the page under the wrong type entirely (confirmed by a first run:
	// the new page silently inherited the starter's page type instead).
	const pageTypeSelect = pagesDialog.locator('.Select', { hasText: 'Page Type' })
	await pageTypeSelect.locator('button.primary').click()
	// Scope strictly to the open dropdown popup's option buttons — the
	// page type's name also appears unscoped in the toolbar breadcrumb
	// (we're still routed on that page type's editor from step 2), so an
	// unscoped text match can silently click the breadcrumb instead of
	// the intended option and leave the dropdown never actually opened/selected.
	await pageTypeSelect.locator('.popup .options button', { hasText: pageTypeName }).click()

	const pageCreateResponsePromise = page.waitForResponse(
		(res) => res.url().includes('/api/collections/pages/records') && res.request().method() === 'POST',
		{ timeout: 10000 }
	)
	// Click the form's actual submit button rather than pressing Enter —
	// after clicking the dropdown option above, focus is on the (now
	// closed) dropdown trigger, not inside the form's text input, so
	// Enter has nothing to submit and silently does nothing.
	await pagesDialog.locator('form button[type="submit"], form button:not([type])').last().click()
	const pageCreateRes = await pageCreateResponsePromise
	expect(pageCreateRes.ok()).toBeTruthy()
	const newPage = await pageCreateRes.json()

	// Close the pages dialog and navigate into the new page.
	await page.keyboard.press('Escape')
	await expect(pagesDialog).toBeHidden({ timeout: 5000 })

	await page.goto(`${TEST_SERVER_URL}/admin/sites/${newSiteId}/${newPage.slug || newPage.id}`)
	await page.getByRole('tab', { name: 'Blocks' }).click()

	return { newSiteId, newSymbol, newPage, devToken }
}

test.describe('Full build flow (site creation through publish)', () => {
	// STRICT UI COVERAGE — no API mutations anywhere in this test, including
	// on failure. If the drag interaction doesn't register, this test fails
	// with a clear message rather than substituting an API call to make
	// the flow "work" — a false pass here would hide a real regression in
	// the drag-and-drop path. (API reads to verify state, e.g. confirming a
	// section now exists, are fine and used below.)
	test('UI: developer can drag a block onto a new page', async ({ page, request }) => {
		test.setTimeout(60000)
		const { newSymbol, newPage, devToken } = await buildSiteThroughPageCreation(page, request)

		// Native HTML5 drag-and-drop (Pragmatic DnD) doesn't respond to
		// Playwright's synthetic dragstart/drop DOM events; it uses its own
		// pointer-based sensors. A real mouse-sequence (move -> down -> move
		// in steps -> up) is the closest thing to a genuine user drag
		// Playwright can drive, and is the ONLY UI path to add a block to a
		// page today — there is no click/keyboard/context-menu alternative
		// (confirmed by reading Page.svelte, Sidebar_Symbol.svelte, and
		// BlockToolbar.svelte: add_section_to_page is only ever called from
		// two dropTargetForElements onDrop callbacks).
		const dragSource = page.locator(`[data-test-id="symbol-${newSymbol.id}"]`)
		// .empty-state lives in Page.svelte's own <main>, outside the canvas
		// iframe (it's the "no sections yet" placeholder around the iframe,
		// not rendered content within it).
		const dropTarget = page.locator('.empty-state')
		await expect(dropTarget).toBeVisible({ timeout: 5000 })

		const sourceBox = await dragSource.boundingBox()
		const targetBox = await dropTarget.boundingBox()
		expect(sourceBox, 'drag source (sidebar block) has no bounding box').toBeTruthy()
		expect(targetBox, 'drop target (.empty-state) has no bounding box').toBeTruthy()

		await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
		await page.mouse.down()
		await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 10 })
		await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 2 })
		await page.mouse.up()

		// Verify success via the API (a real section record existing for this
		// page), not DOM visibility of the dropped block's content — the
		// block's own text field starts empty (no default value was set when
		// the field was created), and an empty <h1> has no rendered box for
		// Playwright to consider "visible" regardless of whether the drop
		// itself worked. This is a read used only to verify the outcome of
		// the UI action above, not a substitute for it.
		await expect(async () => {
			const sectionsRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_sections/records`, {
				headers: { Authorization: `Bearer ${devToken}` },
				params: { filter: `page = "${newPage.id}"` }
			})
			const sections = (await sectionsRes.json()).items
			expect(sections, 'no page_sections record was created by the drag — the drop did not register').toHaveLength(1)
			expect(sections[0].symbol).toBe(newSymbol.id)
		}).toPass({ timeout: 5000 })
	})

	// API-ASSISTED INTEGRATION COVERAGE — explicitly not a UI-only test.
	// Steps 1-4 (site/page-type/block/page creation) are still driven
	// entirely through the UI via buildSiteThroughPageCreation, but adding
	// the block to the page uses a direct API call to the same endpoint
	// the drop handler itself calls (PageSections.create, per
	// add_section_to_page in Page.svelte), because this test's purpose is
	// covering content-edit -> publish -> served-output, not re-proving the
	// drag interaction (see the UI-only test above for that). If this test
	// fails, treat it as a build/publish regression, not a drag regression.
	test('API-assisted: content edit on a newly built page survives publish', async ({ page, request }) => {
		test.setTimeout(60000)
		const { newSiteId, newSymbol, newPage, devToken } = await buildSiteThroughPageCreation(page, request)

		// Assert the section create here rather than letting a failure
		// resurface later as the "Expected exactly 1 section" check below,
		// which would misreport a setup error as a product problem.
		const sectionCreateRes = await request.post(`${TEST_SERVER_URL}/api/collections/page_sections/records`, {
			headers: { Authorization: `Bearer ${devToken}` },
			data: { page: newPage.id, symbol: newSymbol.id, index: 0 }
		})
		if (!sectionCreateRes.ok()) {
			throw new Error(`Failed to attach block to page: ${sectionCreateRes.status()} ${await sectionCreateRes.text()}`)
		}

		// The section's text field starts empty (no default value was set
		// when the field was created), and ComponentNode.svelte's
		// field-matching explicitly skips wiring up empty text elements as
		// editable (`!element.textContent.trim()` short-circuits before
		// set_editable_text runs) — so an empty headline could never be
		// clicked into to test editing at all. Seed a real starting value,
		// the same way a block author would give a field sensible default
		// content.
		const sectionsRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_sections/records`, {
			headers: { Authorization: `Bearer ${devToken}` },
			params: { filter: `page = "${newPage.id}"` }
		})
		const sections = (await sectionsRes.json()).items
		if (sections.length !== 1) {
			throw new Error(`Expected exactly 1 section on the new page, found ${sections.length}`)
		}
		const targetSection = sections[0]

		const symbolFieldsRes = await request.get(`${TEST_SERVER_URL}/api/collections/site_symbol_fields/records`, {
			headers: { Authorization: `Bearer ${devToken}` },
			params: { filter: `symbol = "${newSymbol.id}" && key = "headline"` }
		})
		const symbolFields = (await symbolFieldsRes.json()).items
		if (symbolFields.length !== 1) {
			throw new Error(`Expected exactly 1 "headline" field on symbol ${newSymbol.id}, found ${symbolFields.length}`)
		}
		const headlineField = symbolFields[0]
		const seedEntryRes = await request.post(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
			headers: { Authorization: `Bearer ${devToken}` },
			data: { section: targetSection.id, field: headlineField.id, value: 'Original Headline', index: 0, locale: 'en' }
		})
		if (!seedEntryRes.ok()) {
			throw new Error(`Failed to seed headline entry: ${seedEntryRes.status()} ${await seedEntryRes.text()}`)
		}
		// Force an actual refetch: page.goto() to a URL identical to the
		// current one is a same-document navigation SvelteKit's router can
		// no-op (no new data load), which would leave the canvas showing
		// pre-seed state forever. reload() is the correct tool for
		// "refetch this same page."
		await page.reload()

		// --- edit content (UI) and publish (UI) ---
		const headline = canvasFrame(page).locator('[data-testid="built-headline"]')
		await expect(headline).toHaveText('Original Headline', { timeout: 15000 })

		const finalHeadline = `Published from full build flow ${Date.now()}`
		await replaceContentEditableText(page, headline, finalHeadline)
		// Register the listener BEFORE blur(), which is what triggers the
		// save: waitForResponse only matches responses that arrive after
		// it starts listening, so registering it afterward can miss a fast
		// save and time out on content that was in fact persisted.
		const entrySavePromise = page.waitForResponse(
			(res) => res.url().includes('/api/collections/page_section_entries/records') && res.request().method() !== 'GET',
			{ timeout: 5000 }
		)
		await headline.blur()
		const entrySaveRes = await entrySavePromise
		expect(entrySaveRes.ok()).toBeTruthy()

		const generateResponsePromise = page.waitForResponse(
			(res) => res.url().includes('/api/primo/generate') && res.request().method() === 'POST',
			{ timeout: 15000 }
		)
		await page.getByRole('button', { name: /^(Preview|Publish)$/ }).click()
		const publishDialog = page.getByRole('dialog')
		const confirmButton = publishDialog.getByRole('button', { name: /publish|preview|confirm/i }).first()
		if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await confirmButton.click()
		}
		const generateRes = await generateResponsePromise
		expect(generateRes.ok()).toBeTruthy()

		// The new page is not the site's homepage (that's still the cloned
		// starter's original "Home" page) — request its own path, not the
		// bare site root, or this fetches the wrong page's published output.
		const publishedRes = await request.get(`${TEST_SERVER_URL}/${newPage.slug || newPage.id}?_site=${newSiteId}`)
		expect(publishedRes.ok()).toBeTruthy()
		const html = await publishedRes.text()
		expect(html).toContain(finalHeadline)
	})
})
