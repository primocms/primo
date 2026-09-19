import { test, expect, type Page } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, loginAs, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth, ensureEditorUser, apiLoginAs } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite

/**
 * Documented contract (docs/CLAUDE.md "The Collaboration Model" +
 * "Field Implementation Details"):
 *   - Editors can create pages, add blocks (from available options), manage
 *     content, drag-and-drop reorder body blocks.
 *   - Editors "cannot touch code, modify page types, change header/footer
 *     blocks, or break design."
 *
 * What the code actually enforces (found during recon of
 * migrations/1757326533_collections_snapshot.go and
 * migrations/1763250053_fix_api_rules.go): EVERY PocketBase collection API
 * rule for page_types, site_symbols (blocks), page_sections, and their
 * entries is gated only on "does a site_role_assignments row exist for this
 * (user, site)" — none of them inspect the row's `role` value ('editor' vs
 * 'developer'). The only place `role`/`serverRole` VALUE is checked is:
 *   - internal/limits.go — a billing seat-counter, not a permission gate.
 *   - A handful of frontend {#if} conditionals in Toolbar.svelte (gates the
 *     "Page options" menu / Page Types link visibility only).
 * So: editor vs developer is a UI-only distinction today. This test
 * documents that gap with evidence rather than asserting the aspirational
 * contract as if it were enforced.
 */
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

	test('UI hides the developer-only "Page options" (Page Types) control from an editor', async ({ page, request }) => {
		const { token: devToken } = await devAuth(request)
		const editor = await ensureEditorUser(request, devToken, ids.siteId)

		// The dropdown trigger is annotated aria-label="Page options" in
		// source (Toolbar.svelte) but bits-ui's prop-spread on the snippet
		// child does not forward it through to the rendered DOM — the only
		// accessible name that survives is the shared sr-only "More" text,
		// which collides with an unrelated "More" button elsewhere in the
		// toolbar, and .navigation-group's class is similarly stripped from
		// the compiled output. Target it structurally instead: the
		// dropdown-menu trigger inside the same .button-group as the
		// "Pages" button.
		const pageOptionsTriggerOn = (target: Page) =>
			target.locator('.button-group', { has: target.getByRole('button', { name: 'Pages' }) }).locator('[data-dropdown-menu-trigger]')

		// Confirm the control IS visible for a developer, to rule out a
		// selector mistake before asserting its absence for the editor.
		await loginAsDeveloper(page, ids.siteId)
		const devFrame = canvasFrame(page)
		await expect(devFrame.locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
		await expect(pageOptionsTriggerOn(page)).toBeVisible({ timeout: 5000 })

		// The editor session gets its OWN page. Both login helpers seed the
		// auth token via addInitScript, and those registrations accumulate:
		// logging in as the editor on this same page would leave both the
		// developer's and the editor's script queued for the next
		// navigation, with Playwright not defining which runs last. The
		// assertion below would then be testing an undefined identity —
		// the whole point of this test.
		const editorPage = await page.context().newPage()
		await loginAs(editorPage, editor.email, editor.password, ids.siteId)
		const editorFrame = canvasFrame(editorPage)
		await expect(editorFrame.locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
		await expect(pageOptionsTriggerOn(editorPage)).toHaveCount(0)
		await editorPage.close()
	})

	// KNOWN GAP, reproduced (not papered over): every PocketBase collection API
	// rule for page_types (and site_symbols, page_sections, entries) checks
	// only whether a site_role_assignments row exists for (user, site) — it
	// never inspects the row's `role` value. So an editor can create/modify
	// page types via a direct API call, even though the documented
	// collaboration model says editors "cannot ... modify page types." This
	// is a product gap, tracked separately; this test documents it as an
	// *expected* failure rather than accepting whatever the server does.
	test.describe('direct-API authorization: editor creating a page_type', () => {
		// Everything that can fail for a reason OTHER than "the known
		// permission gap" — auth, the create attempt itself, and the
		// independent lookup — runs here as NORMAL, always-enforced
		// assertions, outside any test.fail() body. Only the final
		// comparison against the documented denial contract lives in the
		// expected-failure test below; this hook captures the raw
		// observations it compares against.
		let devToken: string
		let editorToken: string
		let attemptedName: string
		let observedCreateStatus: number
		let matchingRecordCount: number

		test.beforeAll(async ({ request }) => {
			;({ token: devToken } = await devAuth(request))
			const editor = await ensureEditorUser(request, devToken, ids.siteId)

			// Confirm the editor actually authenticates successfully, and
			// confirm the role assignment on record is really 'editor' (not
			// just "some row exists") — both are prerequisites for the
			// authorization assertion below to mean what it claims to mean.
			editorToken = await apiLoginAs(request, editor.email, editor.password)

			const assignmentsRes = await request.get(`${TEST_SERVER_URL}/api/collections/site_role_assignments/records`, {
				headers: { Authorization: `Bearer ${devToken}` },
				params: { filter: `site = "${ids.siteId}" && user = "${editor.userId}"` }
			})
			expect(assignmentsRes.ok()).toBeTruthy()
			const assignments = (await assignmentsRes.json()).items
			expect(assignments).toHaveLength(1)
			expect(assignments[0].role).toBe('editor')

			// Attempt to create a new page_type directly via the PocketBase
			// REST API as the editor — per docs, editors should not be able
			// to modify page types. Run and validate this here, not in the
			// expected-failure test: a network/setup failure (e.g. a 5xx, a
			// timeout, a malformed response) must fail this test outright,
			// not be silently absorbed as "the known permission gap."
			attemptedName = `Editor-created type ${Date.now()}`
			const createRes = await request.post(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
				headers: { Authorization: `Bearer ${editorToken}` },
				data: { site: ids.siteId, name: attemptedName }
			})
			observedCreateStatus = createRes.status()
			// Only 200 (bug: create succeeded) or 400 (correctly denied — see
			// the expected-failure test for why 400, not 403, is the
			// PocketBase-correct denial here) are outcomes this test is
			// designed to compare against. Anything else — a 5xx, a 401 from
			// a broken editor login, etc. — is an infrastructure problem and
			// must fail loudly right here.
			expect([200, 400]).toContain(observedCreateStatus)

			// Independent lookup by the exact attempted name (don't trust
			// createRes's own body/id) using developer authority, since an
			// editor's create call — successful or not — has no reason to be
			// trusted to report its own outcome honestly. Validate the
			// lookup itself succeeded before trusting its count.
			const listRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
				headers: { Authorization: `Bearer ${devToken}` },
				params: { filter: `site = "${ids.siteId}" && name = "${attemptedName}"` }
			})
			expect(listRes.ok()).toBeTruthy()
			matchingRecordCount = (await listRes.json()).items.length
		})

		// test.fail() semantics: Playwright expects THIS test to fail. If a
		// future fix adds server-side role-value enforcement, this assertion
		// starts passing and Playwright reports it as an UNEXPECTED PASS —
		// which fails the run and is exactly the signal to delete the
		// test.fail() line below and let the assertion stand as a normal,
		// enforced pass. No network calls or setup here — only a comparison
		// against values already captured (and validated) in beforeAll, so
		// this body can only fail for the one reason it claims to.
		test.fail(
			"editor can create a page_type via direct API — PocketBase rules don't check role value (product bug, not a test gap)",
			async () => {
				// The PocketBase-correct denial for a CreateRule filter
				// evaluating to false is HTTP 400 with a generic "Failed to
				// create record" body — verified empirically against this same
				// server (both a fully anonymous request and an authenticated
				// user with zero site_role_assignments rows on the target site
				// return 400, never 403). Do not assume 403 just because
				// that's the conventional REST "forbidden" code.
				//
				// The real-world-meaningful half of the contract: zero
				// matching records must exist afterward, independent of
				// status code.
				expect({ status: observedCreateStatus, createdCount: matchingRecordCount }).toEqual({ status: 400, createdCount: 0 })
			}
		)

		// Cleanup runs as a normal, always-executed hook — not conditionally
		// inside the expected-failure body — so a change in behavior (e.g. the
		// bug getting fixed, or the create unexpectedly returning a different
		// shape) can never cause pollution to silently go uncleaned. Assert
		// the lookup and every deletion succeed: a silent cleanup failure here
		// would leak state into later runs/tests without ever being reported.
		test.afterAll(async ({ request }) => {
			const listRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
				headers: { Authorization: `Bearer ${devToken}` },
				params: { filter: `site = "${ids.siteId}" && name ~ "Editor-created type"` }
			})
			expect(listRes.ok()).toBeTruthy()
			const leftover = (await listRes.json()).items ?? []
			for (const record of leftover) {
				const deleteRes = await request.delete(`${TEST_SERVER_URL}/api/collections/page_types/records/${record.id}`, {
					headers: { Authorization: `Bearer ${devToken}` }
				})
				expect(deleteRes.ok()).toBeTruthy()
			}
		})
	})
})
