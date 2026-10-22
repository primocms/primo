import { test, expect, type Locator } from '@playwright/test'
import { TEST_SERVER_URL } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, openBlockContentModal } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

async function dragBefore(page: any, source: Locator, target: Locator, edge: 'top' | 'bottom' = 'top') {
	await source.scrollIntoViewIfNeeded()
	await target.scrollIntoViewIfNeeded()
	const start = await source.boundingBox()
	const end = await target.boundingBox()
	if (!start || !end) throw new Error('Drag handle/target missing')
	await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
	await page.mouse.down()
	await page.mouse.move(start.x + start.width / 2 + 6, start.y + start.height / 2, { steps: 3 })
	await page.mouse.move(end.x + end.width / 2, end.y + (edge === 'top' ? 3 : end.height - 3), { steps: 12 })
	await page.mouse.move(end.x + end.width / 2, end.y + (edge === 'top' ? 3 : end.height - 3))
	await page.mouse.up()
}

test('drag, edit, create, delete, keyboard move and save retry preserve repeater identity', async ({ page, request }) => {
	test.setTimeout(90000)
	const { token } = await devAuth(request)
	const site = await seedFixtureSite(token, 'Repeater Reordering')
	const headers = { Authorization: `Bearer ${token}` }
	async function create(field: string, index: number, parent = '', value: any = null) {
		const response = await request.post(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
			headers,
			data: { section: site.sectionId, field, index, parent, value, locale: 'en' }
		})
		expect(response.ok(), await response.text()).toBe(true)
		return (await response.json()).id as string
	}
	const ids: Record<string, string> = {}
	for (const [name, index] of [
		['Alpha', 0],
		['Bravo', 3],
		['Charlie', 8]
	] as const) {
		ids[name] = await create(site.fieldIds.items, index)
		await create(site.fieldIds.name, 0, ids[name], name)
		await create(site.fieldIds.description, 0, ids[name], `${name} description`)
	}
	async function persisted() {
		const response = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
			headers,
			params: { filter: `section = "${site.sectionId}"`, perPage: 200 }
		})
		const entries = (await response.json()).items as any[]
		return entries
			.filter((entry) => entry.field === site.fieldIds.items && !entry.parent)
			.sort((a, b) => a.index - b.index)
			.map((item) => ({
				id: item.id,
				index: item.index,
				name: entries.find((entry) => entry.parent === item.id && entry.field === site.fieldIds.name)?.value,
				description: entries.find((entry) => entry.parent === item.id && entry.field === site.fieldIds.description)?.value
			}))
	}
	await loginAsDeveloper(page, site.siteId)
	await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
	let dialog = await openBlockContentModal(page, canvasFrame(page).locator('[data-testid="headline"]'))
	const rows = () => dialog.locator('.RepeaterFieldItem')
	const row = (id: string) => dialog.locator(`[data-entry-id="${id}"]`)
	const order = () => rows().evaluateAll((elements) => elements.map((element) => element.getAttribute('data-entry-id')))
	await row(ids.Charlie).locator('button.title').click()
	await expect(row(ids.Charlie).locator('[id$="-name"] textarea')).toBeVisible()
	await dragBefore(page, row(ids.Charlie).locator('.repeater-move'), row(ids.Alpha).locator('.item-options'))
	await expect.poll(order).toEqual([ids.Charlie, ids.Alpha, ids.Bravo])
	// Expansion follows the moved ID, and a subsequent edit follows its new position.
	await expect(row(ids.Charlie).locator('[id$="-name"] textarea')).toBeVisible()
	await expect(row(ids.Alpha).locator('[id$="-name"] textarea')).toHaveCount(0)
	await row(ids.Charlie).locator('[id$="-description"] textarea').fill('Charlie edited after dragging')
	await expect.poll(async () => (await persisted()).map((item) => item.id)).toEqual([ids.Alpha, ids.Bravo, ids.Charlie])

	await dialog.getByRole('button', { name: 'Create Item' }).click()
	const delta = rows().last()
	await expect(delta.locator('[id$="-name"] textarea')).toBeVisible()
	const deltaId = (await delta.getAttribute('data-entry-id')) as string
	await delta.locator('[id$="-name"] textarea').fill('Delta')
	await delta.locator('[id$="-description"] textarea').fill('Unsaved new item')
	await delta.locator('.repeater-move').focus()
	await page.keyboard.press('Enter')
	await expect(page.getByRole('menuitem', { name: 'Move to first', exact: true })).toBeVisible()
	await page.screenshot({ path: test.info().outputPath('repeater-move-menu.png'), animations: 'disabled' })
	await page.getByRole('menuitem', { name: 'Move to first', exact: true }).click()
	await expect.poll(order).toEqual([deltaId, ids.Charlie, ids.Alpha, ids.Bravo])
	await expect(row(deltaId).locator('.repeater-move')).toBeFocused()
	await row(ids.Bravo).getByTitle('Delete Item item', { exact: true }).click()

	// Reject the entire save once, then retry through the real Save button.
	await page.route('**/api/primo/repeater-order', (route) =>
		route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ status: 500, message: 'Injected failure', data: {} }) })
	)
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog.getByRole('alert')).toContainText('order could not be saved')
	await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
	// Existing indices stayed intact after the failed transaction.
	expect((await persisted()).find((item) => item.id === ids.Charlie)?.index).toBe(8)
	await page.unroute('**/api/primo/repeater-order')
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog).toBeHidden()
	await expect.poll(async () => (await persisted()).map((item) => item.id)).toEqual([deltaId, ids.Charlie, ids.Alpha])
	const saved = await persisted()
	expect(saved.map((item) => item.index)).toEqual([0, 1, 2])
	expect(saved.find((item) => item.id === ids.Charlie)?.description).toBe('Charlie edited after dragging')
	expect(saved.find((item) => item.id === ids.Alpha)?.description).toBe('Alpha description')
	expect(saved.find((item) => item.id === deltaId)?.name).toBe('Delta')

	await page.reload()
	await expect(canvasFrame(page).locator('[data-testid="items"] li')).toHaveCount(3)
	await expect(canvasFrame(page).locator('[data-testid="items"] li')).toHaveText([/Delta/, /Charlie/, /Alpha/])
	dialog = await openBlockContentModal(page, canvasFrame(page).locator('[data-testid="headline"]'))
	await expect.poll(order).toEqual([deltaId, ids.Charlie, ids.Alpha])
	await expect(row(ids.Charlie).locator('[id$="-name"] textarea')).toBeVisible()
	await dragBefore(page, row(deltaId).locator('.repeater-move'), row(ids.Alpha).locator('.item-options'), 'bottom')
	await expect.poll(order).toEqual([ids.Charlie, ids.Alpha, deltaId])
	await dragBefore(page, row(ids.Charlie).locator('.repeater-move'), row(ids.Charlie).locator('.item-options'))
	await expect.poll(order).toEqual([ids.Charlie, ids.Alpha, deltaId])
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog).toBeHidden()
	await expect.poll(async () => (await persisted()).map((item) => item.id)).toEqual([ids.Charlie, ids.Alpha, deltaId])
})

test('nested drag stays within its parent list and Browse mode removes movement controls', async ({ page, request }) => {
	test.setTimeout(60000)
	await page.setViewportSize({ width: 1440, height: 1100 })
	const { token } = await devAuth(request)
	const site = await seedFixtureSite(token, 'Nested Repeater Reordering')
	const headers = { Authorization: `Bearer ${token}` }
	async function create(collection: string, data: Record<string, any>) {
		const response = await request.post(`${TEST_SERVER_URL}/api/collections/${collection}/records`, { headers, data })
		expect(response.ok(), await response.text()).toBe(true)
		return (await response.json()).id as string
	}
	const nestedField = await create('site_symbol_fields', { symbol: site.symbolId, parent: site.fieldIds.items, key: 'nested', label: 'Subitems', type: 'repeater', index: 2 })
	const nestedName = await create('site_symbol_fields', { symbol: site.symbolId, parent: nestedField, key: 'subname', label: 'Subname', type: 'text', index: 0 })
	const parents: string[] = []
	const children: string[][] = []
	for (let index = 0; index < 2; index++) {
		const parent = await create('page_section_entries', { section: site.sectionId, field: site.fieldIds.items, locale: 'en', index })
		parents.push(parent)
		await create('page_section_entries', { section: site.sectionId, field: site.fieldIds.name, locale: 'en', parent, index: 0, value: `Parent ${index + 1}` })
		children[index] = []
		for (let childIndex = 0; childIndex < 2; childIndex++) {
			const child = await create('page_section_entries', { section: site.sectionId, field: nestedField, parent, locale: 'en', index: childIndex })
			children[index].push(child)
			await create('page_section_entries', { section: site.sectionId, field: nestedName, parent: child, locale: 'en', index: 0, value: `Child ${index + 1}.${childIndex + 1}` })
		}
	}
	await loginAsDeveloper(page, site.siteId)
	await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
	const dialog = await openBlockContentModal(page, canvasFrame(page).locator('[data-testid="headline"]'))
	const row = (id: string) => dialog.locator(`[data-entry-id="${id}"]`)
	for (const parent of parents) await row(parent).locator('button.title').first().click()
	const order = (parent: string) =>
		row(parent)
			.locator('.RepeaterFieldItem')
			.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-entry-id')))
	await dragBefore(page, row(children[0][1]).locator('.repeater-move'), row(children[0][0]).locator('.item-options'))
	await expect.poll(() => order(parents[0])).toEqual([children[0][1], children[0][0]])
	await dragBefore(page, row(children[0][0]).locator('.repeater-move'), row(children[1][0]).locator('.item-options'))
	await expect.poll(() => order(parents[0])).toEqual([children[0][1], children[0][0]])
	await expect.poll(() => order(parents[1])).toEqual(children[1])
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog).toBeHidden()
	const response = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, { headers, params: { filter: `section = "${site.sectionId}"`, perPage: 200 } })
	const entries = (await response.json()).items as any[]
	expect(
		entries
			.filter((entry) => entry.field === nestedField && entry.parent === parents[0])
			.sort((a, b) => a.index - b.index)
			.map((entry) => entry.id)
	).toEqual([children[0][1], children[0][0]])
	expect(
		entries
			.filter((entry) => entry.field === nestedField && entry.parent === parents[1])
			.sort((a, b) => a.index - b.index)
			.map((entry) => entry.id)
	).toEqual(children[1])

	await page.route('**/api/primo/dev-auth', async (route) => {
		const response = await route.fetch()
		await route.fulfill({ response, json: { ...(await response.json()), author_mode: 'files' } })
	})
	await page.reload()
	await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible({ timeout: 15000 })
	await canvasFrame(page).locator('[data-testid="headline"]').hover()
	await page.getByRole('button', { name: 'View Block Content', exact: true }).click()
	const browse = page.getByRole('dialog')
	await expect(browse.locator('.RepeaterField').first()).toBeVisible()
	await expect(browse.locator('.repeater-move')).toHaveCount(0)
	await expect(browse.getByRole('button', { name: 'Create Item', exact: true })).toHaveCount(0)
	await expect(browse.locator('button.title').first()).toBeEnabled()
})
