import { test, expect, type Locator, type Page } from '@playwright/test'
import { loginAsDeveloper, canvasFrame } from './helpers/editor'
import { devAuth, SERVER_URL } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

async function dragPage(page: Page, source: Locator, target: Locator, edge: 'top' | 'bottom') {
	await source.scrollIntoViewIfNeeded()
	await target.scrollIntoViewIfNeeded()
	// A previous reorder updates DOM order before its FLIP animation finishes.
	// Hover waits for stable geometry so the next native drag picks up the
	// requested row rather than a sibling moving through its old coordinates.
	await target.hover()
	await source.hover()
	const start = (await source.boundingBox())!
	const end = (await target.boundingBox())!
	await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
	await page.mouse.down()
	await page.mouse.move(start.x + start.width / 2 + 8, start.y + start.height / 2, { steps: 4 })
	const inset = Math.min(3, end.height / 2)
	await page.mouse.move(end.x + end.width / 2, end.y + (edge === 'top' ? inset : end.height - inset), { steps: 12 })
	await page.mouse.up()
}

for (const deleteParent of [false, true]) {
	test(`deleting the active nested page${deleteParent ? "'s parent" : ''} returns to Home`, async ({ page, request }) => {
		const { token } = await devAuth(request)
		const ids = await seedFixtureSite(token, 'Delete active nested page')
		const headers = { Authorization: `Bearer ${token}` }
		const home = await (await request.get(`${SERVER_URL}/api/collections/pages/records/${ids.pageId}`, { headers })).json()
		async function create(name: string, parent: string) {
			const response = await request.post(`${SERVER_URL}/api/collections/pages/records`, {
				headers,
				data: { name, slug: name.toLowerCase(), parent, index: 0, site: ids.siteId, page_type: home.page_type }
			})
			expect(response.ok()).toBeTruthy()
			return response.json()
		}
		const parent = await create('Parent', ids.pageId)
		const child = await create('Child', parent.id)
		if (deleteParent) await create('Grandchild', child.id)
		await loginAsDeveloper(page, ids.siteId)
		await page.goto(`/admin/sites/${ids.siteId}/parent/child`)
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		const dialog = page.getByRole('dialog', { name: /^Pages/ })
		await dialog.locator(`[data-page-id="${parent.id}"]`).getByRole('button', { name: 'Toggle child pages' }).click()
		await dialog.getByRole('button', { name: `Options for ${deleteParent ? 'Parent' : 'Child'}`, exact: true }).click()
		await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
		if (deleteParent) await page.getByRole('button', { name: 'Delete All', exact: true }).click()
		await expect(page).toHaveURL(`${SERVER_URL}/admin/sites/${ids.siteId}`)
		const response = await request.get(`${SERVER_URL}/api/collections/pages/records/${child.id}`, { headers })
		expect(response.status()).toBe(404)
		await expect(page.getByText('Could not delete these pages. Please try again.')).toHaveCount(0)
	})
}

for (const nested of [false, true]) {
	test(`${nested ? 'nested' : 'root'} pages reorder in their visible order and persist after reload`, async ({ page, request }) => {
		const { token } = await devAuth(request)
		const ids = await seedFixtureSite(token, `Page ordering ${nested}`)
		const headers = { Authorization: `Bearer ${token}` }
		const home = await (await request.get(`${SERVER_URL}/api/collections/pages/records/${ids.pageId}`, { headers })).json()
		async function create(name: string, parent: string, index: number) {
			const response = await request.post(`${SERVER_URL}/api/collections/pages/records`, {
				headers,
				data: { name, slug: name.toLowerCase(), parent, index, site: ids.siteId, page_type: home.page_type }
			})
			expect(response.ok(), await response.text()).toBeTruthy()
			return response.json()
		}
		const parent = nested ? await create('Parent', ids.pageId, 1) : home
		const siblings: { id: string }[] = []
		for (const [name, index] of [
			['Alpha', 1],
			['Bravo', 4],
			['Charlie', 9]
		] as const)
			siblings.push(await create(name, parent.id, index))
		await loginAsDeveloper(page, ids.siteId)
		await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible()
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		const dialog = page.getByRole('dialog')
		const row = (id: string) => dialog.locator(`[data-page-id="${id}"]`)
		if (nested) await row(parent.id).getByRole('button', { name: 'Toggle child pages' }).click()
		const visibleOrder = () =>
			dialog.locator('[data-page-id]').evaluateAll(
				(nodes, ids) => nodes.map((node) => node.getAttribute('data-page-id')).filter((id) => ids.includes(id!)),
				siblings.map((s) => s.id)
			)
		await expect.poll(visibleOrder).toEqual(siblings.map((s) => s.id))
		await dragPage(page, row(siblings[2].id).locator('.drag-handle'), row(siblings[0].id), 'top')
		const reordered = [siblings[2].id, siblings[0].id, siblings[1].id]
		await expect.poll(visibleOrder).toEqual(reordered)
		await expect
			.poll(async () => {
				const response = await request.get(`${SERVER_URL}/api/collections/pages/records`, { headers, params: { filter: `parent = "${parent.id}"`, sort: 'index' } })
				return (await response.json()).items.map((item) => item.id)
			})
			.toEqual(reordered)
		await page.reload()
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		if (nested) {
			const toggle = row(parent.id).getByRole('button', { name: 'Toggle child pages' })
			await expect(toggle).toBeEnabled()
			if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
		}
		await expect.poll(visibleOrder).toEqual(reordered)
		await dragPage(page, row(siblings[2].id).locator('.drag-handle'), row(siblings[1].id), 'bottom')
		await expect.poll(visibleOrder).toEqual(siblings.map((s) => s.id))
		if (!nested) {
			const gap = row(siblings[2].id).locator('xpath=ancestor::li[1]').locator(':scope > .drop-target-gap')
			await dragPage(page, row(siblings[0].id).locator('.drag-handle'), gap, 'bottom')
			await expect.poll(visibleOrder).toEqual([siblings[1].id, siblings[2].id, siblings[0].id])
			const firstGap = row(home.id).locator('xpath=ancestor::li[1]').locator(':scope > .drop-target-gap')
			await dragPage(page, row(siblings[0].id).locator('.drag-handle'), firstGap, 'bottom')
			await expect.poll(visibleOrder).toEqual(siblings.map((s) => s.id))
		}
	})
}

test('page rename rejects an empty name and preserves a failed save for retry', async ({ page, request }) => {
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Page rename recovery')
	const headers = { Authorization: `Bearer ${token}` }
	await loginAsDeveloper(page, ids.siteId)
	await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible()
	await page.getByRole('button', { name: 'Pages', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('button', { name: 'Options for Home', exact: true }).click()
	await page.getByRole('menuitem', { name: 'Change Name', exact: true }).click()
	const input = dialog.locator('[contenteditable="true"]')
	await input.fill('')
	await input.press('Enter')
	await expect(page.getByText('Enter a page name.', { exact: true })).toBeVisible()
	const target = `**/api/collections/pages/records/${ids.pageId}`
	await page.route(target, (route) =>
		route.request().method() === 'PATCH' ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Rename rejected.' }) }) : route.continue()
	)
	await input.fill('Renamed Home')
	await input.press('Enter')
	await expect(page.getByText('Rename rejected.', { exact: true })).toBeVisible()
	await expect(input).toHaveText('Renamed Home')
	await page.unroute(target)
	await input.press('Enter')
	await expect(dialog.getByRole('link', { name: 'Renamed Home', exact: true })).toBeVisible()
	const response = await request.get(`${SERVER_URL}/api/collections/pages/records/${ids.pageId}`, { headers })
	expect((await response.json()).name).toBe('Renamed Home')
	await page.reload()
	await page.getByRole('button', { name: 'Pages', exact: true }).click()
	await expect(dialog.getByRole('link', { name: 'Renamed Home', exact: true })).toBeVisible()
})
