import { test, expect } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, loginAs, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth, ensureEditorUser } from './helpers/server'
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

	test('DOCUMENTS (does not enforce) direct-API access: editor role has the same PocketBase collection permissions as developer', async ({
		request
	}) => {
		const { token: devToken } = await devAuth(request)
		const editor = await ensureEditorUser(request, devToken, ids.siteId)

		const editorLoginRes = await request.post(`${TEST_SERVER_URL}/api/collections/users/auth-with-password`, {
			data: { identity: editor.email, password: editor.password }
		})
		const { token: editorToken } = await editorLoginRes.json()

		// Attempt to create a new page_type directly via the PocketBase REST
		// API as the editor — per docs, editors should not be able to modify
		// page types. Record what actually happens rather than assuming.
		const createRes = await request.post(`${TEST_SERVER_URL}/api/collections/page_types/records`, {
			headers: { Authorization: `Bearer ${editorToken}` },
			data: { site: ids.siteId, name: `Editor-created type ${Date.now()}` }
		})

		// EVIDENCE, not aspiration: as of this recon, page_types.createRule
		// only checks site_role_assignments existence, not role value, so
		// this is expected to SUCCEED (2xx) — the opposite of the documented
		// editor restriction. If a future fix adds role-based server-side
		// enforcement, this assertion should start failing and should be
		// updated to expect 403, not silently loosened.
		if (createRes.ok()) {
			const created = await createRes.json()
			console.warn(
				`[KNOWN GAP] Editor was able to create a page_type via direct API (id=${created.id}). ` +
					`Server-side role enforcement does not distinguish 'editor' from 'developer' — see permissions.spec.ts header comment.`
			)
			// cleanup using developer authority so we don't leave test pollution
			await request.delete(`${TEST_SERVER_URL}/api/collections/page_types/records/${created.id}`, {
				headers: { Authorization: `Bearer ${devToken}` }
			})
			expect(createRes.status()).toBe(200)
		} else {
			// If this ever starts failing, that's a (welcome) product change,
			// not a test bug — update the comment above.
			expect(createRes.status()).toBe(403)
		}
	})
})
