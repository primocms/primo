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
async function getRepeaterItems(request: any, token: string) {
	const res = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
		headers: { Authorization: `Bearer ${token}` },
		params: { filter: `section = "${ids.sectionId}"`, perPage: 200 }
	})
	const entries = (await res.json()).items as any[]

	const itemsFieldId = ids.fieldIds.items
	const nameFieldId = ids.fieldIds.name
	const descFieldId = ids.fieldIds.description

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

	test('create, edit, reorder, delete, and re-edit preserve correct item identity', async ({ page, request }) => {
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

		// --- 2a: create three distinctly named items ---
		await createItem('Alpha', 'First created item')
		await createItem('Bravo', 'Second created item')
		await createItem('Charlie', 'Third created item')

		let items = await getRepeaterItems(request, token)
		expect(items.map((i) => i.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
		const alphaId = items[0].id
		const bravoId = items[1].id
		const charlieId = items[2].id

		// --- 2b: edit the middle item (Bravo) ---
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

		// --- 2c: reorder — move Charlie before Alpha ---
		// The drag-and-drop reorder UI in RepeaterFieldItem.svelte is dead code
		// (the onMount block with draggable()/dropTargetForElements() is
		// commented out; RepeaterField.svelte never wires an on:move handler
		// either), so there is currently no UI path to reorder repeater
		// items. Exercising via a direct entry.index update against the real
		// backend instead, to verify identity-preservation at the
		// persistence layer (the part the task cares about), while
		// recording the UI gap in the report.
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

		items = await getRepeaterItems(request, token)
		expect(items.map((i) => i.name)).toEqual(['Charlie', 'Alpha', 'Bravo Edited'])
		// identity check: content followed the item id, not the slot
		expect(items.find((i) => i.id === charlieId)?.description).toBe('Third created item')
		expect(items.find((i) => i.id === alphaId)?.description).toBe('First created item')
		expect(items.find((i) => i.id === bravoId)?.description).toBe('Second created item')

		// --- 2d: delete one item (Alpha) ---
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

		// --- 2e: edit again after delete+reorder, then reload; verify final state ---
		const charlieItemLocator = dialog.locator('.RepeaterFieldItem', { hasText: 'Charlie' })
		await expandItem(charlieItemLocator)
		const charlieDescInput = charlieItemLocator.locator('[id$="-description"] textarea')
		await charlieDescInput.fill('Third item, edited after reorder and a sibling deletion')
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
		expect(finalCharlie?.description).toBe('Third item, edited after reorder and a sibling deletion')
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
})
