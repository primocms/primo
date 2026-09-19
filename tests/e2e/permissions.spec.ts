import { test, expect } from '@playwright/test'
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
		await headline.blur()
		await page.waitForResponse(
			(res) => res.url().includes('/api/collections/page_section_entries/records/') && res.request().method() === 'PATCH',
			{ timeout: 5000 }
		)

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
		const pageOptionsTrigger = page.locator('.button-group', { has: page.getByRole('button', { name: 'Pages' }) }).locator('[data-dropdown-menu-trigger]')

		// Confirm the control IS visible for a developer, to rule out a
		// selector mistake before asserting its absence for the editor.
		await loginAsDeveloper(page, ids.siteId)
		const devFrame = canvasFrame(page)
		await expect(devFrame.locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
		await expect(pageOptionsTrigger).toBeVisible({ timeout: 5000 })

		await loginAs(page, editor.email, editor.password, ids.siteId)
		const editorFrame = canvasFrame(page)
		await expect(editorFrame.locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
		await expect(pageOptionsTrigger).toHaveCount(0)
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
		// All of this runs as NORMAL, always-enforced assertions — outside any
		// test.fail() body. If auth setup breaks, or the role assignment isn't
		// what we think it is, that must fail this test outright rather than
		// being absorbed into "the known bug's expected failure."
		let editorToken: string

		test.beforeAll(async ({ request }) => {
			const { token: devToken } = await devAuth(request)
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
		})

		// test.fail() semantics: Playwright expects THIS test to fail. If a
		// future fix adds server-side role-value enforcement, this assertion
		// starts passing and Playwright reports it as an UNEXPECTED PASS —
		// which fails the run and is exactly the signal to delete the
		// test.fail() line below and let the assertion stand as a normal,
		// enforced pass. Scoped to ONLY the authorization outcome: setup,
		// auth, and cleanup all happen outside this body (above/below), so an
		// unrelated infra failure can't be silently absorbed as "the known
		// bug."
		test.fail(
			"editor can create a page_type via direct API — PocketBase rules don't check role value (product bug, not a test gap)",
			async ({ request }) => {
				const { token: devToken } = await devAuth(request)
				const attemptedName = `Editor-created type ${Date.now()}`

				// Attempt to create a new page_type directly via the PocketBase
				// REST API as the editor — per docs, editors should not be able
				// to modify page types.
				const createRes = await request.post(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
					headers: { Authorization: `Bearer ${editorToken}` },
					data: { site: ids.siteId, name: attemptedName }
				})

				// The PocketBase-correct denial for a CreateRule filter evaluating
				// to false is HTTP 400 with a generic "Failed to create record"
				// body — verified empirically against this same server (both a
				// fully anonymous request and an authenticated user with zero
				// site_role_assignments rows on the target site both return 400,
				// never 403). Do not assume 403 just because that's the
				// conventional REST "forbidden" code; assert what this system's
				// permission contract actually produces on a genuine denial.
				expect(createRes.status()).toBe(400)

				// The stronger, real-world-meaningful check: no unauthorized
				// record must exist afterward, regardless of what status code
				// came back. Look it up independently by the exact attempted
				// name (don't trust createRes's own body/id) using developer
				// authority, since an editor's create call — successful or
				// not — has no reason to be trusted to report its own outcome
				// honestly here.
				const listRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
					headers: { Authorization: `Bearer ${devToken}` },
					params: { filter: `site = "${ids.siteId}" && name = "${attemptedName}"` }
				})
				const created = (await listRes.json()).items
				expect(created).toHaveLength(0)
			}
		)

		// Cleanup runs as a normal, always-executed hook — not conditionally
		// inside the expected-failure body — so a change in behavior (e.g. the
		// bug getting fixed, or the create unexpectedly returning a different
		// shape) can never cause pollution to silently go uncleaned.
		test.afterAll(async ({ request }) => {
			const { token: devToken } = await devAuth(request)
			const listRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
				headers: { Authorization: `Bearer ${devToken}` },
				params: { filter: `site = "${ids.siteId}" && name ~ "Editor-created type"` }
			})
			const leftover = (await listRes.json()).items ?? []
			for (const record of leftover) {
				await request.delete(`${TEST_SERVER_URL}/api/collections/page_types/records/${record.id}`, {
					headers: { Authorization: `Bearer ${devToken}` }
				})
			}
		})
	})
})
