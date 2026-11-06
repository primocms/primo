import { test, expect, type Page } from '@playwright/test'
import { loginAsDeveloperAtDashboard } from './helpers/editor'
import { devAuth } from './helpers/server'

let siteGroups: any[]
let libraryGroups: any[]
let sites: any[]
let blocks: any[]

test.beforeAll(async ({ request }) => {
	const { token } = await devAuth(request)
	const headers = { Authorization: `Bearer ${token}` }
	async function create(collection: string, data: any) {
		const response = await request.post(`/api/collections/${collection}/records`, { headers, data })
		expect(response.ok(), await response.text()).toBe(true)
		return response.json()
	}
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
	siteGroups = await Promise.all(['Alpha', 'Beta', 'Empty'].map((name, index) => create('site_groups', { name: `Sites ${name} ${suffix}`, index })))
	libraryGroups = await Promise.all(['Alpha', 'Beta', 'Empty'].map((name, index) => create('library_symbol_groups', { name: `Library ${name} ${suffix}`, index })))
	sites = await Promise.all(siteGroups.slice(0, 2).map((group, index) => create('sites', { name: `Site ${index ? 'Beta' : 'Alpha'}`, group: group.id, host: `group-check-${Date.now()}-${index}.invalid`, index: 0 })))
	blocks = await Promise.all(libraryGroups.slice(0, 2).map((group, index) => create('library_symbols', { name: `Block ${index ? 'Beta' : 'Alpha'}`, group: group.id, html: '<div style="height:320px">Group preview</div>', css: '', js: '', index: 0 })))
})

async function checkGroup(page: Page, group: any, names: string[], cardSelector: string, emptyHeading: string) {
	await page.evaluate(({ groupId, cardSelector }) => {
		const state = window as any
		const run = { frames: [] as any[], active: true }
		state.groupSample = run
		const sample = () => {
			if (state.groupSample !== run || !run.active) return
			if (new URL(location.href).searchParams.get('group') === groupId) {
				const inset = document.querySelector('.dashboard-content')!
				const headers = [...inset.querySelectorAll(':scope > header')]
				run.frames.push({
					headers: headers.length,
					top: headers[0]?.getBoundingClientRect().top - inset.getBoundingClientRect().top,
					names: [...inset.querySelectorAll(cardSelector)].map(card => card.textContent!.trim()),
					empty: [...inset.querySelectorAll('h2')].some(heading => /This group is empty|No blocks in this group|No starters in this category|No blocks in this category/.test(heading.textContent ?? ''))
				})
			}
			if (run.active) requestAnimationFrame(sample)
		}
		requestAnimationFrame(sample)
	}, { groupId: group.id, cardSelector })
	await page.getByRole('link', { name: group.name, exact: true }).click()
	await expect(page).toHaveURL(new RegExp(`group=${group.id}`))
	if (names.length) await expect(page.locator(`.dashboard-content ${cardSelector}`)).toHaveText(names)
	else await expect(page.getByRole('heading', { name: emptyHeading, exact: true })).toBeVisible()
	await page.waitForTimeout(250)
	const frames = await page.evaluate(() => {
		const state = window as any
		state.groupSample.active = false
		return state.groupSample.frames as { headers: number; top: number; names: string[]; empty: boolean }[]
	})
	expect.soft(frames.length, `${group.name}: capture the group transition`).toBeGreaterThan(2)
	expect.soft(frames.filter(frame => frame.headers !== 1 || Math.abs(frame.top) > 1), `${group.name}: keep the header stable`).toEqual([])
	expect.soft(frames.filter(frame => frame.names.some(name => !names.includes(name)) || new Set(frame.names).size !== frame.names.length), `${group.name}: no stale or duplicate cards`).toEqual([])
	if (names.length) expect.soft(frames.filter(frame => frame.empty), `${group.name}: no empty-state flash`).toEqual([])
}

test('Sites groups keep one stable grid through populated and empty groups', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await loginAsDeveloperAtDashboard(page, siteGroups[0].id)
	const cardSelector = '.site-card-footer > div > a'
	await expect(page.locator(`.dashboard-content ${cardSelector}`)).toHaveText(['Site Alpha'])
	for (const index of [1, 2, 0, 1, 0]) {
		await checkGroup(page, siteGroups[index], index < 2 ? [sites[index].name] : [], cardSelector, 'This group is empty')
	}
})

test('Library groups do not flash stale or empty content under delayed loading', async ({ page }) => {
	await page.route('**/api/collections/library_symbols/records*', async route => {
		await new Promise(resolve => setTimeout(resolve, 180))
		await route.continue()
	})
	await loginAsDeveloperAtDashboard(page)
	await page.getByRole('button', { name: 'Library', exact: true }).click()
	await page.getByRole('link', { name: libraryGroups[0].name, exact: true }).click()
	await expect(page.locator('.dashboard-content .catalog-name')).toHaveText(['Block Alpha'])
	for (const index of [1, 2, 0, 1, 0]) {
		await checkGroup(page, libraryGroups[index], index < 2 ? [blocks[index].name] : [], '.catalog-name', 'No blocks in this group')
	}
})

for (const section of ['starters', 'blocks'] as const) {
	test(`Marketplace ${section} categories stay stable under delayed loading`, async ({ page }) => {
		const groups = (section === 'starters' ? siteGroups : libraryGroups).map((group, index) => ({ ...group, name: `Category ${index + 1}` }))
		await page.route('https://main.marketplace.primo.page/api/**', async route => {
			const url = new URL(route.request().url())
			const collection = url.pathname.split('/')[3]
			let items: any[] = []
			if (collection === 'site_groups' || collection === 'library_symbol_groups') items = groups
			else if (collection === 'sites' || collection === 'library_symbols') {
				const index = groups.findIndex(group => (url.searchParams.get('filter') ?? '').includes(group.id))
				if (index >= 0 && index < 2) items = section === 'starters' ? [{ ...sites[index], group: groups[index].id, host: 'group-preview.test' }] : [{ ...blocks[index], group: groups[index].id }]
			}
			await new Promise(resolve => setTimeout(resolve, 180))
			await route.fulfill({ status: 200, contentType: 'application/json', json: { page: 1, perPage: 500, totalItems: items.length, totalPages: 1, items } })
		})
		await page.route('https://group-preview.test/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Starter preview</p>' }))
		await loginAsDeveloperAtDashboard(page)
		await page.getByRole('button', { name: 'Marketplace', exact: true }).click()
		if (section === 'blocks') await page.getByRole('link', { name: 'Blocks', exact: true }).click()
		const records = section === 'starters' ? sites : blocks
		await expect(page.locator('.dashboard-content .catalog-name')).toHaveText([records[0].name])
		for (const index of [1, 2, 0, 1, 0]) {
			await checkGroup(page, groups[index], index < 2 ? [records[index].name] : [], '.catalog-name', section === 'starters' ? 'No starters in this category' : 'No blocks in this category')
		}
	})
}
