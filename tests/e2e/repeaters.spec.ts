import { test, expect, type Locator } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, openBlockContentModal } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite

/** Reads all page_section_entries for the fixture section and reconstructs
 * repeater items (grouped by `parent`, ordered by `index`) so assertions can
 * check identity — not just positional text — the way Content.svelte.ts
 * (resolveEntries) actually resolves them. */
async function getRepeaterItems(request: any, token: string, site: SeededSite = ids) {
	const res = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
		headers: { Authorization: `Bearer ${token}` },
		params: { filter: `section = "${site.sectionId}"`, perPage: 200 }
	})
	const entries = (await res.json()).items as any[]

	const itemsFieldId = site.fieldIds.items
	const nameFieldId = site.fieldIds.name
	const descFieldId = site.fieldIds.description

	// Repeater item "container" entries: field === items, no parent
	const itemEntries = entries.filter((e) => e.field === itemsFieldId && !e.parent).sort((a, b) => a.index - b.index)

	return itemEntries.map((itemEntry) => {
		const name = entries.find((e) => e.field === nameFieldId && e.parent === itemEntry.id)
		const description = entries.find((e) => e.field === descFieldId && e.parent === itemEntry.id)
		return {
			id: itemEntry.id,
			index: itemEntry.index,
			name: name?.value,
			description: description?.value
		}
	})
}

/** Expanded/collapsed state (visibleRepeaters) persists per-field across
 * dialog opens via idb-keyval, so the title button is sometimes already
 * expanded and sometimes not — check before clicking rather than assuming. */
async function expandItem(itemLocator: Locator) {
	const nameInput = itemLocator.locator('[id$="-name"] textarea')
	if (await nameInput.isVisible().catch(() => false)) return
	await itemLocator.locator('button.title').click()
	await expect(nameInput).toBeVisible({ timeout: 5000 })
}

test.describe('Repeaters', () => {
	test.beforeAll(async ({ request }) => {
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'Repeaters Fixture')
	})

	// UI COVERAGE: every step in this test is driven through the real editor
	// UI (create/edit/delete buttons, Save, reload) — no direct API writes.
	// Reordering is intentionally NOT exercised here; see the backend-only
	// test and the fixme below for why.
	test('UI: create, edit, delete, and re-edit preserve correct item identity', async ({ page, request }) => {
		const { token } = await devAuth(request)
		await loginAsDeveloper(page, ids.siteId)

		const frame = canvasFrame(page)
		const headline = frame.locator('[data-testid="headline"]')
		await expect(headline).toBeVisible({ timeout: 15000 })

		let dialog = await openBlockContentModal(page, headline)

		// BlockEditor.svelte's field/entry edits (oninput -> EntryCollection.
		// create/update) only persist server-side when self.commit() runs,
		// which here happens in save_component() — bound to the modal's Save
		// button (and Cmd/Ctrl+S) — and save_component() also closes the
		// modal (header.button.onclick(block)) afterward. Unlike canvas
		// inline edits (which debounce their own commit without closing
		// anything), every meaningful mutation in this modal needs an
		// explicit Save, and the dialog must be reopened for the next step.
		async function saveAndReopen() {
			const responsePromise = page
				.waitForResponse(
					(res) => res.url().includes('/api/collections/page_section_entries/records') && res.request().method() !== 'GET',
					{ timeout: 5000 }
				)
				.catch(() => null) // a no-op save may not fire a matching request
			await dialog.getByRole('button', { name: 'Save' }).click()
			await responsePromise
			await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 })
			dialog = await openBlockContentModal(page, canvasFrame(page).locator('[data-testid="headline"]'))
		}

		async function createItem(name: string, description: string) {
			await dialog.getByRole('button', { name: 'Create Item' }).click()
			await page.waitForTimeout(300)
			const newItem = dialog.locator('.RepeaterFieldItem').last()
			await expandItem(newItem)
			const nameInput = newItem.locator('[id$="-name"] textarea')
			const descInput = newItem.locator('[id$="-description"] textarea')
			await nameInput.fill(name)
			await descInput.fill(description)
			await nameInput.blur()
			await saveAndReopen()
		}

		// --- create three distinctly named items ---
		await createItem('Alpha', 'First created item')
		await createItem('Bravo', 'Second created item')
		await createItem('Charlie', 'Third created item')

		let items = await getRepeaterItems(request, token)
		expect(items.map((i) => i.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
		const alphaId = items[0].id
		const bravoId = items[1].id
		const charlieId = items[2].id

		// --- edit the middle item (Bravo) ---
		const bravoItemLocator = dialog.locator('.RepeaterFieldItem', { hasText: 'Bravo' })
		await expandItem(bravoItemLocator)
		const bravoNameInput = bravoItemLocator.locator('[id$="-name"] textarea')
		await bravoNameInput.fill('Bravo Edited')
		await bravoNameInput.blur()
		await saveAndReopen()

		items = await getRepeaterItems(request, token)
		expect(items.find((i) => i.id === alphaId)?.name).toBe('Alpha')
		expect(items.find((i) => i.id === bravoId)?.name).toBe('Bravo Edited')
		expect(items.find((i) => i.id === charlieId)?.name).toBe('Charlie')

		// --- delete one item (Alpha) ---
		await page.reload()
		const reloadedFrame = canvasFrame(page)
		await expect(reloadedFrame.locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
		dialog = await openBlockContentModal(page, reloadedFrame.locator('[data-testid="headline"]'))

		const alphaItemLocator = dialog.locator('.RepeaterFieldItem', { hasText: 'Alpha' })
		await alphaItemLocator.locator('button[title="Delete Item item"]').click()
		await saveAndReopen()

		items = await getRepeaterItems(request, token)
		expect(items.length).toBe(2)
		expect(items.find((i) => i.id === alphaId)).toBeUndefined()
		expect(items.map((i) => i.name).sort()).toEqual(['Bravo Edited', 'Charlie'].sort())

		// --- edit again after delete, then reload; verify final state ---
		const charlieItemLocator = dialog.locator('.RepeaterFieldItem', { hasText: 'Charlie' })
		await expandItem(charlieItemLocator)
		const charlieDescInput = charlieItemLocator.locator('[id$="-description"] textarea')
		await charlieDescInput.fill('Third item, edited after a sibling deletion')
		await charlieDescInput.blur()
		await saveAndReopen()

		await page.reload()
		const finalFrame = canvasFrame(page)
		await expect(finalFrame.locator('[data-testid="items"]')).toBeVisible({ timeout: 15000 })

		items = await getRepeaterItems(request, token)
		expect(items.length).toBe(2)
		const finalCharlie = items.find((i) => i.id === charlieId)
		const finalBravo = items.find((i) => i.id === bravoId)
		expect(finalCharlie?.name).toBe('Charlie')
		expect(finalCharlie?.description).toBe('Third item, edited after a sibling deletion')
		expect(finalBravo?.name).toBe('Bravo Edited')
		expect(finalBravo?.description).toBe('Second created item')

		// no duplicates, nothing resurrected
		const idsSeen = items.map((i) => i.id)
		expect(new Set(idsSeen).size).toBe(idsSeen.length)
		expect(idsSeen).not.toContain(alphaId)

		// canvas reflects the same final state
		const itemTexts = await finalFrame.locator('[data-testid="items"] li').allTextContents()
		expect(itemTexts.some((t) => t.includes('Charlie'))).toBe(true)
		expect(itemTexts.some((t) => t.includes('Bravo Edited'))).toBe(true)
		expect(itemTexts.some((t) => t.includes('Alpha'))).toBe(false)
		expect(itemTexts.length).toBe(2)
	})

	// BACKEND-ONLY COVERAGE — explicitly not UI coverage. There is currently
	// no way to reorder repeater items through the editor UI at all: the
	// drag-and-drop handling in RepeaterFieldItem.svelte's onMount
	// (draggable()/dropTargetForElements() from
	// @atlaskit/pragmatic-drag-and-drop) is entirely commented out, and
	// RepeaterField.svelte never wires up any alternative (e.g. move
	// up/down buttons). This test exercises reordering by writing directly
	// to page_section_entries.index via the API, bypassing the (unavailable)
	// UI entirely, to verify that the persistence-layer identity model
	// (Content.svelte.ts's resolveEntries pairing subfields to their parent
	// by relation + index, not array position) correctly keeps content
	// bound to the right item across a reorder. It intentionally does NOT
	// claim to cover the UI drag interaction — see the fixme below for that
	// gap.
	test('backend: reordering via direct index update preserves item identity (no UI drag-reorder exists to test)', async ({ request }) => {
		const { token } = await devAuth(request)
		// Independent fixture site (not the describe-level `ids`) so this
		// test's item set can never collide with items left behind by the
		// UI test above, keeping the two tests independently repeatable.
		const reorderIds = await seedFixtureSite(token, 'Repeaters Backend Reorder Fixture')

		// page_section_entries.locale is a required field (confirmed via a
		// live 400 "Cannot be blank" error against an empty string) — the
		// fixture's own seeded entries all use 'en', so match that rather
		// than an empty/omitted value.
		async function createItemViaApi(name: string, description: string, index: number) {
			const itemRes = await request.post(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
				headers: { Authorization: `Bearer ${token}` },
				data: { section: reorderIds.sectionId, field: reorderIds.fieldIds.items, value: '', index, locale: 'en' }
			})
			if (!itemRes.ok()) throw new Error(`failed to create repeater item entry: ${itemRes.status()} ${await itemRes.text()}`)
			const item = await itemRes.json()
			const nameRes = await request.post(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
				headers: { Authorization: `Bearer ${token}` },
				data: { section: reorderIds.sectionId, field: reorderIds.fieldIds.name, parent: item.id, value: name, index: 0, locale: 'en' }
			})
			if (!nameRes.ok()) throw new Error(`failed to create name subfield entry: ${nameRes.status()} ${await nameRes.text()}`)
			const descRes = await request.post(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
				headers: { Authorization: `Bearer ${token}` },
				data: {
					section: reorderIds.sectionId,
					field: reorderIds.fieldIds.description,
					parent: item.id,
					value: description,
					index: 0,
					locale: 'en'
				}
			})
			if (!descRes.ok()) throw new Error(`failed to create description subfield entry: ${descRes.status()} ${await descRes.text()}`)
			return item.id as string
		}

		const alphaId = await createItemViaApi('Alpha', 'First created item', 0)
		const bravoId = await createItemViaApi('Bravo', 'Second created item', 1)
		const charlieId = await createItemViaApi('Charlie', 'Third created item', 2)

		const getItems = () => getRepeaterItems(request, token, reorderIds)
		let items = await getItems()
		expect(items.map((i) => i.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])

		// move Charlie before Alpha
		await request.patch(`${TEST_SERVER_URL}/api/collections/page_section_entries/records/${alphaId}`, {
			headers: { Authorization: `Bearer ${token}` },
			data: { index: 1 }
		})
		await request.patch(`${TEST_SERVER_URL}/api/collections/page_section_entries/records/${bravoId}`, {
			headers: { Authorization: `Bearer ${token}` },
			data: { index: 2 }
		})
		await request.patch(`${TEST_SERVER_URL}/api/collections/page_section_entries/records/${charlieId}`, {
			headers: { Authorization: `Bearer ${token}` },
			data: { index: 0 }
		})

		items = await getItems()
		expect(items.map((i) => i.name)).toEqual(['Charlie', 'Alpha', 'Bravo'])
		// identity check: content followed the item id, not the slot
		expect(items.find((i) => i.id === charlieId)?.description).toBe('Third created item')
		expect(items.find((i) => i.id === alphaId)?.description).toBe('First created item')
		expect(items.find((i) => i.id === bravoId)?.description).toBe('Second created item')
	})

	// Documents the UI coverage gap explicitly (rather than leaving it only
	// as a comment) so it shows up in the test report as a real, tracked
	// item rather than silently missing coverage. Skipped, not failing: this
	// is a missing feature, not a regression to chase.
	test.fixme(
		'UI: drag-and-drop reorder of repeater items (NOT IMPLEMENTED — RepeaterFieldItem.svelte drag handlers are commented out, no alternative reorder control exists)',
		async () => {}
	)
})
