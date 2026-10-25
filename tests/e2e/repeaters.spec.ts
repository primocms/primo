import { test, expect, type Locator } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, openBlockContentModal, loginAs } from './helpers/editor'
import { devAuth, ensureEditorUser } from './helpers/server'
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
	// Reordering is exercised through the UI in repeater-reordering.spec.ts.

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
				.waitForResponse((res) => res.url().includes('/api/collections/page_section_entries/records') && res.request().method() !== 'GET', { timeout: 5000 })
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

	// Storage-only regression coverage. Real drag/menu/save coverage lives in
	// repeater-reordering.spec.ts.

	test('backend: reordering via direct index update preserves item identity', async ({ request }) => {
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

	test('content-only editor reorders items and nested repeaters without losing identity or source permissions', async ({ page, request }) => {
		test.setTimeout(60000)
		const { token } = await devAuth(request)
		const site = await seedFixtureSite(token, 'Editor Reordering')
		const headers = { Authorization: `Bearer ${token}` }
		const url = (collection: string, id = '') => `${TEST_SERVER_URL}/api/collections/${collection}/records${id ? '/' + id : ''}`
		async function create(collection: string, data: any) {
			const res = await request.post(url(collection), { headers, data })
			expect(res.ok(), await res.text()).toBeTruthy()
			return res.json()
		}
		const details = await create('site_symbol_fields', { symbol: site.symbolId, parent: site.fieldIds.items, key: 'details', label: 'Details', type: 'group', index: 2 })
		const links = await create('site_symbol_fields', { symbol: site.symbolId, parent: details.id, key: 'links', label: 'Links', type: 'repeater', index: 0 })
		const label = await create('site_symbol_fields', { symbol: site.symbolId, parent: links.id, key: 'label', label: 'Label', type: 'text', index: 0 })
		const makeEntry = (field: string, parent: string | undefined, index = 0, value: any = null) =>
			create('page_section_entries', { section: site.sectionId, field, parent, index, value, locale: 'en' })
		const containers: any[] = []
		for (const [position, name] of ['Alpha', 'Bravo', 'Charlie'].entries()) {
			const item = await makeEntry(site.fieldIds.items, undefined, [0, 2, 5][position])
			containers.push(item)
			await makeEntry(site.fieldIds.name, item.id, 0, name)
			await makeEntry(site.fieldIds.description, item.id, 0, `${name} description`)
		}
		const group = await makeEntry(details.id, containers[0].id)
		const first = await makeEntry(links.id, group.id)
		const second = await makeEntry(links.id, group.id, 1)
		await makeEntry(label.id, first.id, 0, 'First nested link')
		await makeEntry(label.id, second.id, 0, 'Second nested link')
		const snapshot = async () => {
			const res = await request.get(url('page_section_entries'), { headers, params: { filter: `section = "${site.sectionId}"`, perPage: 200 } })
			expect(res.ok()).toBeTruthy()
			return (await res.json()).items
		}
		// The image stub serves a 1px PNG; seed its known metadata so the image
		// field's ordinary dimension normalization cannot obscure reorder assertions.
		const image = (await snapshot()).find((e: any) => e.field === site.fieldIds.image)
		if (image) {
			const normalized = await request.patch(url('page_section_entries', image.id), { headers, data: { value: { ...image.value, width: 1, height: 1, upload: null } } })
			expect(normalized.ok()).toBeTruthy()
		}
		const before = await snapshot()
		const source = await (await request.get(url('site_symbols', site.symbolId), { headers })).json()
		const editor = await ensureEditorUser(request, token, site.siteId)
		await loginAs(page, editor.email, editor.password, site.siteId)
		const headline = canvasFrame(page).getByTestId('headline')
		await expect(headline).toBeVisible({ timeout: 15000 })
		let dialog = await openBlockContentModal(page, headline)
		expect(await dialog.getByRole('button', { name: 'Create Field', exact: true }).count()).toBe(0)
		const item = (id: string) => dialog.locator(`.RepeaterFieldItem[data-entry-id="${id}"]`)
		async function move(id: string, label: string, keyboard = false) {
			const trigger = item(id).getByRole('button', { name: /^Rearrange / })
			if (keyboard) { await trigger.focus(); await page.keyboard.press('Enter') }
			else await trigger.click()
			const menuId = await trigger.getAttribute('aria-controls')
			expect(menuId).toBeTruthy()
			const menu = page.locator(`[role="menu"][id="${menuId}"]`)
			await menu.getByRole('menuitem', { name: label, exact: true }).click()
			await menu.waitFor({ state: 'hidden' })
		}
		await move(containers[2].id, 'Move earlier', true)
		await move(containers[2].id, 'Move later')
		await move(containers[2].id, 'Move to first')
		await expandItem(item(containers[2].id))
		await item(containers[2].id).locator('[id$="-description"] textarea').fill('Charlie edited after moving')
		await item(containers[2].id).locator('[id$="-description"] textarea').blur()
		await expandItem(item(containers[0].id))
		await move(second.id, 'Move earlier')
		await dialog.getByRole('button', { name: 'Save', exact: true }).click()
		await expect(dialog).toBeHidden()
		await page.reload()
		await expect(canvasFrame(page).getByTestId('headline')).toBeVisible({ timeout: 15000 })
		dialog = await openBlockContentModal(page, canvasFrame(page).getByTestId('headline'))
		const order = await dialog.locator('.repeater-level-0 > ul > li > .RepeaterFieldItem').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-entry-id')))
		expect(order).toEqual([containers[2].id, containers[0].id, containers[1].id])
		const after = await snapshot()
		expect(after.map((e: any) => e.id).sort()).toEqual(before.map((e: any) => e.id).sort())
		for (const original of before) {
			const current = after.find((e: any) => e.id === original.id)
			expect({ field: current.field, parent: current.parent, locale: current.locale }).toEqual({ field: original.field, parent: original.parent, locale: original.locale })
			expect(current.value).toEqual(original.parent === containers[2].id && original.field === site.fieldIds.description ? 'Charlie edited after moving' : original.value)
		}
		expect(after.find((e: any) => e.id === second.id).index).toBe(0)
		expect(after.find((e: any) => e.id === first.id).index).toBe(1)
		await expect(canvasFrame(page).getByTestId('items').locator('.item-name')).toHaveText(['Charlie', 'Alpha', 'Bravo'])
		const persistedSource = await (await request.get(url('site_symbols', site.symbolId), { headers })).json()
		for (const key of ['html', 'css', 'js']) expect(persistedSource[key]).toEqual(source[key])
		const auth = JSON.parse(await page.evaluate(() => localStorage.getItem('pocketbase_auth') || '{}'))
		const denied = await request.patch(url('site_symbols', site.symbolId), { headers: { Authorization: `Bearer ${auth.token}` }, data: { html: '<p>Forbidden</p>' } })
		expect(denied.status()).toBe(403)
	})

})
