import { test, expect, type Page } from '@playwright/test'
import { loginAsDeveloperAtDashboard } from './helpers/editor'
import { devAuth } from './helpers/server'

let siteGroups: any[]
let libraryGroups: any[]
let sites: any[][]
let blocks: any[][]

test.use({ viewport: { width: 1440, height: 800 } })

test.beforeAll(async ({ request }) => {
	const { token } = await devAuth(request)
	async function create(collection: string, data: any) {
		const response = await request.post(`/api/collections/${collection}/records`, { headers: { Authorization: `Bearer ${token}` }, data })
		expect(response.ok(), await response.text()).toBe(true)
		return response.json()
	}
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
	siteGroups = await Promise.all(['Alpha', 'Beta', 'Empty'].map((name, index) => create('site_groups', { name: `Rapid sites ${name} ${suffix}`, index })))
	libraryGroups = await Promise.all(['Alpha', 'Beta', 'Empty'].map((name, index) => create('library_symbol_groups', { name: `Rapid library ${name} ${suffix}`, index })))
	sites = []
	blocks = []
	for (let group = 0; group < 2; group++) {
		sites[group] = []
		blocks[group] = []
		for (let index = 0; index < 12; index++) {
			sites[group].push(await create('sites', { name: `Site ${group}-${index}`, group: siteGroups[group].id, host: `rapid-${suffix}-${group}-${index}.invalid`, index }))
			blocks[group].push(
				await create('library_symbols', {
					name: `Block ${group}-${index}`,
					group: libraryGroups[group].id,
					html: '<section style="min-height:2000px;background:#ccddee">Tall preview</section>',
					css: '',
					js: '',
					index
				})
			)
		}
	}
})

async function scrollContent(page: Page, selector: string, position = 350) {
	// Scroll the finished list, then reload into uncached async previews.
	// Otherwise a preview resize can change the position before leaving.
	await expect.poll(() => page.locator('.dashboard-content .IFrame').evaluateAll((previews) => previews.every((preview) => preview.querySelector('iframe.fadein')))).toBe(true)
	await expect
		.poll(() =>
			page.locator(selector).evaluate((node) => {
				for (let element: Element | null = node; element; element = element.parentElement) {
					if (element.scrollHeight - element.clientHeight > 350 && (element === document.scrollingElement || /auto|scroll/.test(getComputedStyle(element).overflowY))) return true
				}
				return false
			})
		)
		.toBe(true)
	// Use real, non-moving keyboard input to take over restoration. A
	// wheel animation can finish after the exact fixture position is set.
	const focusable = page.locator(selector).locator('button, a[href], [tabindex]:not([tabindex="-1"])').first()
	await focusable.evaluate((node) => (node as HTMLElement).focus({ preventScroll: true }))
	await expect(focusable).toBeFocused()
	await page.keyboard.press('ArrowLeft')
	// Focusing a card can coincide with its final preview resize. Require
	// the requested fixture position, rather than accepting a clamped zero.
	await expect.poll(() => page.locator(selector).evaluate((node, position) => {
		for (let element: Element | null = node; element; element = element.parentElement) {
			if (element.scrollHeight - element.clientHeight > 350 && (element === document.scrollingElement || /auto|scroll/.test(getComputedStyle(element).overflowY))) {
				element.scrollTop = position
				return element.scrollTop
			}
		}
		return 0
	}, position)).toBe(position)
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
	await expect.poll(() => page.locator(selector).evaluate((node) => {
		for (let element: Element | null = node; element; element = element.parentElement) {
			if (element === document.scrollingElement || /auto|scroll/.test(getComputedStyle(element).overflowY)) return element.scrollTop
		}
		return 0
	})).toBe(position)
	return position
}

for (const section of ['sites', 'library'] as const) {
	for (const returnMethod of ['control', 'back'] as const) {
		test(`${section} editor: ${returnMethod} restores the group and scroll position`, async ({ page }) => {
			test.setTimeout(45000)
			const groups = section === 'sites' ? siteGroups : libraryGroups
			const scroller = section === 'sites' ? 'html' : '.masonry'
			await loginAsDeveloperAtDashboard(page, siteGroups[0].id)
			if (section === 'library') await page.getByRole('button', { name: 'Library', exact: true }).click()
			await page.getByRole('link', { name: groups[1].name, exact: true }).click()
			const cards = page.locator(section === 'sites' ? '.site-card-footer > div > a' : '.catalog-preview')
			await expect(cards).toHaveCount(12)
			await scrollContent(page, section === 'sites' ? '.sites-content' : '.masonry', 280)
			const index = await cards.evaluateAll((cards) =>
				cards.findIndex((card) => {
					const box = card.getBoundingClientRect()
					return box.top >= 80 && box.bottom < innerHeight - 20
				})
			)
			expect(index, 'open a visible card without changing the list scroll').toBeGreaterThanOrEqual(0)
			await cards.nth(index).click()
			if (section === 'sites') await expect(page.locator('#primo-toolbar .sites-link')).toBeVisible()
			else {
				await expect(page).toHaveURL(/block=/)
				await expect(page.getByRole('dialog')).toBeVisible()
			}
			if (returnMethod === 'back') await page.goBack()
			else if (section === 'sites') await page.locator('#primo-toolbar .sites-link').click()
			else await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
			await expect(page).toHaveURL(new RegExp(`/dashboard/${section}\\?group=${groups[1].id}$`))
			await expect(page.getByRole('link', { name: groups[1].name, exact: true })).toHaveAttribute('data-active', 'true')
			await expect(page.getByRole('dialog')).toHaveCount(0)
			await expect(cards).toHaveCount(12)
			await expect.poll(() => page.locator(scroller).evaluate((node) => node.scrollTop)).toBe(280)
			await expect(page.locator('.dashboard-content > header')).toHaveCount(1)
			if (returnMethod === 'back') {
				await page.goForward()
				if (section === 'sites') await expect(page.locator('#primo-toolbar .sites-link')).toBeVisible()
				else await expect(page.getByRole('dialog')).toBeVisible()
				await page.goBack()
				await expect(page).toHaveURL(new RegExp(`/dashboard/${section}\\?group=${groups[1].id}$`))
				await expect.poll(() => page.locator(scroller).evaluate((node) => node.scrollTop)).toBe(280)
			}
		})
	}
}

async function checkGroupHistory(page: Page, groups: any[], records: any[][], selector: string, scroller: string, lateLayout = false) {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	const readScroll = () =>
		page.evaluate((selector) => {
			for (let element = document.querySelector(selector); element; element = element.parentElement) {
				if (element === document.scrollingElement || /auto|scroll/.test(getComputedStyle(element).overflowY)) return element.scrollTop
			}
			return 0
		}, scroller)
	async function expectGroup(index: number, scroll: number) {
		await expect(page).toHaveURL(new RegExp(`group=${groups[index].id}`))
		await expect
			.poll(async () => (await page.locator(`.dashboard-content ${selector}`).allTextContents()).map((name) => name.trim()).sort())
			.toEqual((records[index] ?? []).map((record) => record.name).sort())
		if (index === 2)
			await expect(page.locator('.dashboard-content h2').filter({ hasText: /This group is empty|No blocks in this group|No starters in this category|No blocks in this category/ })).toBeVisible()
		await expect.poll(async () => Math.abs((await readScroll()) - scroll), { message: `${groups[index].name}: restore this history entry's scroll position` }).toBeLessThan(1)
		if (lateLayout && index !== 2) {
			const content = page.locator('.marketplace-content > .masonry')
			const display = await content.evaluate((node) => node.style.display)
			await content.evaluate((node) => { node.style.display = 'none' })
			await expect.poll(readScroll).toBe(0)
			await content.evaluate((node, display) => { node.style.display = display }, display)
			await expect.poll(async () => Math.abs((await readScroll()) - scroll), { message: 'late preview relayout retains the history target until user input' }).toBeLessThan(1)
		}
		await expect(page.locator('.dashboard-content > header')).toHaveCount(1)
	}
	await expect(page.locator(`.dashboard-content ${selector}`)).toHaveCount(records[0].length)
	await scrollContent(page, scroller, 280)
	await page.getByRole('link', { name: groups[1].name, exact: true }).click()
	await expect(page.locator(`.dashboard-content ${selector}`)).toHaveCount(records[1].length)
	await scrollContent(page, scroller, 120)
	await page.getByRole('link', { name: groups[0].name, exact: true }).click()
	await expect(page.locator(`.dashboard-content ${selector}`)).toHaveCount(records[0].length)
	// Visiting A twice at different positions distinguishes browser history
	// restoration from a single shared "last scroll for this group" value.
	await scrollContent(page, scroller, 40)
	await page.getByRole('link', { name: groups[2].name, exact: true }).click()
	await expectGroup(2, 0)
	for (const [index, position] of [
		[0, 40],
		[1, 120],
		[0, 280]
	]) {
		await page.goBack()
		await expectGroup(index, position)
	}
	for (const [index, position] of [
		[1, 120],
		[0, 40],
		[2, 0]
	]) {
		await page.goForward()
		await expectGroup(index, position)
	}
	expect(errors, 'history and preview resizing must not emit unhandled browser errors').toEqual([])
}

async function checkGroupRefresh(page: Page, groups: any[], records: any[][], selector: string, scroller: string) {
	// Let the dashboard mount before session validation clears its record
	// cache. Restoration must survive that startup remount as well.
	await page.route('**/api/collections/users/auth-refresh', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 450))
		await route.continue()
	})
	// Use a non-default group to catch a refresh silently selecting the first.
	await page.getByRole('link', { name: groups[1].name, exact: true }).click()
	await expect(page.locator(`.dashboard-content ${selector}`)).toHaveCount(records[1].length)
	const readScroll = () =>
		page.evaluate((selector) => {
			for (let element = document.querySelector(selector); element; element = element.parentElement) {
				if (element === document.scrollingElement || /auto|scroll/.test(getComputedStyle(element).overflowY)) return element.scrollTop
			}
			return 0
		}, scroller)
	for (const position of [280, 120]) {
		await scrollContent(page, scroller, position)
		const validation = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/collections/users/auth-refresh' && response.request().method() === 'POST')
		await page.reload({ waitUntil: 'domcontentloaded' })
		await (await validation).finished()
		// Assert the final authenticated view, after validation clears caches,
		// rather than accepting an early pre-validation render.
		await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
		await expect(page).toHaveURL(new RegExp(`group=${groups[1].id}`))
		await expect(page.getByRole('link', { name: groups[1].name, exact: true })).toHaveAttribute('data-active', 'true')
		await expect.poll(async () => (await page.locator(`.dashboard-content ${selector}`).allTextContents()).map((name) => name.trim()).sort()).toEqual(records[1].map((record) => record.name).sort())
		await expect.poll(async () => Math.abs((await readScroll()) - position), { message: 'refresh restores the selected group and its latest scroll position after async loading' }).toBeLessThan(1)
		await expect(page.locator('.dashboard-content > header')).toHaveCount(1)
	}
	await page.getByRole('link', { name: groups[2].name, exact: true }).click()
	await expect(page.locator('.dashboard-content h2').filter({ hasText: /This group is empty|No blocks in this group|No starters in this category|No blocks in this category/ })).toBeVisible()
	await page.reload({ waitUntil: 'domcontentloaded' })
	await expect(page).toHaveURL(new RegExp(`group=${groups[2].id}`))
	await expect(page.getByRole('link', { name: groups[2].name, exact: true })).toHaveAttribute('data-active', 'true')
	await expect(page.locator('.dashboard-content h2').filter({ hasText: /This group is empty|No blocks in this group|No starters in this category|No blocks in this category/ })).toBeVisible()
	await expect.poll(readScroll).toBe(0)
}

async function checkRapidSwitches(page: Page, groups: any[], records: any[][], selector: string, scroller: string, restoreScroll: boolean) {
	await expect(page.locator(`.dashboard-content ${selector}`)).toHaveCount(records[0].length)
	expect(await scrollContent(page, scroller)).toBeGreaterThan(300)
	// Install before clicking, so even short intermediate selections are checked.
	await page.evaluate(
		({ selector }) => {
			const state = window as any
			state.rapidFrames = []
			state.rapidSampling = true
			const sample = () => {
				const inset = document.querySelector('.dashboard-content')!
				const headers = [...inset.querySelectorAll(':scope > header')]
				state.rapidFrames.push({
					group: new URL(location.href).searchParams.get('group'),
					headers: headers.length,
					offsets: headers.map((header) => header.getBoundingClientRect().top - inset.getBoundingClientRect().top),
					names: [...inset.querySelectorAll(selector)].map((element) => element.textContent!.trim()),
					empty: [...inset.querySelectorAll('h2')].some((element) =>
						/This group is empty|No blocks in this group|No starters in this category|No blocks in this category/.test(element.textContent ?? '')
					)
				})
				if (state.rapidSampling) requestAnimationFrame(sample)
			}
			requestAnimationFrame(sample)
		},
		{ selector }
	)
	for (const index of [1, 2, 0, 1, 2, 1, 0]) {
		await page.getByRole('link', { name: groups[index].name, exact: true }).click()
	}
	await expect(page).toHaveURL(new RegExp(`group=${groups[0].id}`))
	await expect(page.locator(`.dashboard-content ${selector}`)).toHaveCount(records[0].length)
	// Let the slower requests from abandoned groups finish and challenge the
	// latest selection. The route delays below are intentionally unequal.
	await page.waitForTimeout(650)
	await expect.poll(async () => (await page.locator(`.dashboard-content ${selector}`).allTextContents()).map((name) => name.trim()).sort()).toEqual(records[0].map((record) => record.name).sort())
	const frames = await page.evaluate(() => {
		const state = window as any
		state.rapidSampling = false
		return state.rapidFrames as { group: string; headers: number; offsets: number[]; names: string[]; empty: boolean }[]
	})
	expect(frames.length).toBeGreaterThan(10)
	expect(
		frames.filter((frame) => frame.headers !== 1 || frame.offsets.some((top) => Math.abs(top) > 1)),
		'one stable header while switching from a scrolled page'
	).toEqual([])
	for (let index = 0; index < groups.length; index++) {
		const matching = frames.filter((frame) => frame.group === groups[index].id)
		const names = new Set((records[index] ?? []).map((record) => record.name))
		expect(
			matching.filter((frame) => frame.names.some((name) => !names.has(name)) || new Set(frame.names).size !== frame.names.length),
			`${groups[index].name}: no late stale records or duplicate cards`
		).toEqual([])
		if (names.size)
			expect(
				matching.filter((frame) => frame.empty),
				`${groups[index].name}: no false empty state`
			).toEqual([])
	}
	if (restoreScroll) await expect.poll(() => page.locator(scroller).evaluate((node) => node.scrollTop)).toBeGreaterThan(300)
}

for (const section of ['sites', 'library'] as const) {
	for (const mode of ['rapid', 'history', 'refresh'] as const) {
		test(
			mode === 'rapid'
				? `${section}: rapid switches from a scrolled list keep the latest group`
				: mode === 'history'
					? `${section}: browser Back and Forward restore each history entry`
					: `${section}: refresh restores the selected group and scroll position`,
			async ({ page }) => {
				const groups = section === 'sites' ? siteGroups : libraryGroups
				const records = section === 'sites' ? sites : blocks
				if (section === 'library')
					await page.route('**/api/collections/library_symbols/records*', async (route) => {
						const url = new URL(route.request().url())
						await new Promise((resolve) => setTimeout(resolve, url.searchParams.get('filter')?.includes(groups[1].id) ? 450 : 150))
						await route.continue()
					})
				await loginAsDeveloperAtDashboard(page, siteGroups[0].id)
				if (section === 'library') {
					await page.getByRole('button', { name: 'Library', exact: true }).click()
					await page.getByRole('link', { name: groups[0].name, exact: true }).click()
				}
				const selector = section === 'sites' ? '.site-card-footer > div > a' : '.catalog-name'
				const scroller = section === 'sites' ? '.sites-content' : '.masonry'
				if (mode === 'history') await checkGroupHistory(page, groups, records, selector, scroller)
				else if (mode === 'refresh') await checkGroupRefresh(page, groups, records, selector, scroller)
				else await checkRapidSwitches(page, groups, records, selector, scroller, false)
			}
		)
	}
}

for (const section of ['starters', 'blocks'] as const) {
	for (const mode of (section === 'blocks' ? ['rapid', 'history', 'refresh', 'layout'] : ['rapid', 'history', 'refresh']) as readonly ('rapid' | 'history' | 'refresh' | 'layout')[]) {
		test(
			mode === 'rapid'
				? `marketplace ${section}: rapid switches preserve category scroll and reject late responses`
				: mode === 'layout'
					? `marketplace ${section}: late preview resizing preserves each history entry`
					: mode === 'history'
					? `marketplace ${section}: browser Back and Forward restore each history entry`
					: `marketplace ${section}: refresh restores the selected group and scroll position`,
			async ({ page }) => {
				const groups = (section === 'starters' ? siteGroups : libraryGroups).map((group, index) => ({ ...group, name: `Rapid category ${index}` }))
				// Starters have smaller thumbnails than the tall block fixtures; use
				// more rows so the viewport can actually scroll several hundred pixels.
				const records =
					section === 'starters'
						? sites.map((group, groupIndex) =>
								Array.from({ length: 36 }, (_, index) => ({
									...group[index % group.length],
									id: `s${groupIndex}${String(index).padStart(13, '0')}`,
									name: `Starter ${group[0].group}-${index}`,
									index
								}))
							)
						: blocks
				await page.route('https://main.marketplace.primo.page/api/**', async (route) => {
					const url = new URL(route.request().url())
					const collection = url.pathname.split('/')[3]
					const recordId = url.pathname.split('/')[5]
					// A reload starts with an empty record cache and fetches the
					// selected block category directly before its group list arrives.
					if (recordId && collection === 'library_symbol_groups') {
						const record = groups.find((group) => group.id === recordId)
						await route.fulfill({ status: record ? 200 : 404, contentType: 'application/json', json: record ?? { message: 'Not found' } })
						return
					}
					let items: any[] = []
					let index = -1
					if (collection === 'site_groups' || collection === 'library_symbol_groups') items = groups
					else if (collection === 'sites' || collection === 'library_symbols') {
						index = groups.findIndex((group) => (url.searchParams.get('filter') ?? '').includes(group.id))
						if (index >= 0 && index < 2) items = records[index].map((record) => ({ ...record, group: groups[index].id, host: 'rapid-preview.test' }))
					}
					await new Promise((resolve) => setTimeout(resolve, index === 1 ? 450 : 150))
					await route.fulfill({ status: 200, contentType: 'application/json', json: { page: 1, perPage: 500, totalItems: items.length, totalPages: 1, items } })
				})
				await page.route('https://rapid-preview.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Preview</p>' }))
				await loginAsDeveloperAtDashboard(page, siteGroups[0].id)
				await page.getByRole('button', { name: 'Marketplace', exact: true }).click()
				if (section === 'blocks') await page.getByRole('link', { name: 'Blocks', exact: true }).click()
				if (mode === 'history' || mode === 'layout') await checkGroupHistory(page, groups, records, '.catalog-name', '.marketplace-content', mode === 'layout')
				else if (mode === 'refresh') await checkGroupRefresh(page, groups, records, '.catalog-name', '.marketplace-content')
				else await checkRapidSwitches(page, groups, records, '.catalog-name', '.marketplace-content', true)
			}
		)
	}
}
