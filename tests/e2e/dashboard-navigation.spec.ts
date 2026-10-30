import { test, expect } from '@playwright/test'
import { loginAsDeveloperAtDashboard } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

test('Library header starts at the top when leaving Sites', async ({ page, request }) => {
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Dashboard navigation')
	const headers = { Authorization: `Bearer ${token}` }
	const site = await (await request.get(`/api/collections/sites/records/${ids.siteId}`, { headers })).json()
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await loginAsDeveloperAtDashboard(page, site.group)
	await expect(page.getByRole('link', { name: /^Open Dashboard navigation/ })).toBeVisible()

	await page.evaluate(() => {
		const state = window as any
		state.libraryHeaderFrames = []
		state.sampleLibraryHeader = true
		const sample = () => {
			const inset = document.querySelector('.dashboard-content')
			const libraryHeader = inset?.querySelector('header:has([aria-label="How blocks work"])')
			if (libraryHeader) state.libraryHeaderFrames.push({ top: libraryHeader.getBoundingClientRect().top, insetTop: inset!.getBoundingClientRect().top })
			if (state.sampleLibraryHeader) requestAnimationFrame(sample)
		}
		requestAnimationFrame(sample)
	})
	await page.getByRole('button', { name: 'Library', exact: true }).click()
	await expect(page).toHaveURL(/\/dashboard\/library/)
	await expect(page.getByRole('button', { name: 'How blocks work', exact: true })).toBeVisible()
	await page.waitForTimeout(300)
	const frames = await page.evaluate(() => {
		const state = window as any
		state.sampleLibraryHeader = false
		return state.libraryHeaderFrames as { top: number; insetTop: number }[]
	})
	expect(frames.length).toBeGreaterThan(2)
	expect(frames.filter(frame => Math.abs(frame.top - frame.insetTop) > 1), 'Library header must not be pushed below the departing Sites page').toEqual([])
})

test('all dashboard sections switch without reloading, blank headers, or layout jumps', async ({ page, request }) => {
	test.setTimeout(60000)
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Dashboard switch matrix')
	const headers = { Authorization: `Bearer ${token}` }
	const site = await (await request.get(`/api/collections/sites/records/${ids.siteId}`, { headers })).json()
	// Keep the marketplace fixture deterministic and exercise its loading state.
	await page.route('https://main.marketplace.primo.page/api/**', async route => {
		const isGroups = route.request().url().includes('/site_groups/records') || route.request().url().includes('/library_symbol_groups/records')
		const items = isGroups ? [{ id: site.group, name: 'Test category', index: 0 }] : []
		await new Promise(resolve => setTimeout(resolve, 150))
		await route.fulfill({ status: 200, contentType: 'application/json', json: { page: 1, perPage: 500, totalItems: items.length, totalPages: 1, items } })
	})
	await page.addInitScript(() => {
		;(window as any).dashboardDocumentId = crypto.randomUUID()
	})
	await loginAsDeveloperAtDashboard(page, site.group)
	await expect(page.getByRole('link', { name: /^Open Dashboard switch matrix/ })).toBeVisible()
	const directions = ['Library', 'Marketplace', 'Sites', 'Marketplace', 'Library', 'Sites'] as const
	let from = 'Sites'
	for (const destination of directions) {
		const documentId = await page.evaluate(() => (window as any).dashboardDocumentId)
		await page.evaluate(() => {
			const state = window as any
			state.dashboardFrames = []
			state.sampleDashboard = true
			const sample = () => {
				const inset = document.querySelector('.dashboard-content')
				const headers = inset ? [...inset.querySelectorAll(':scope > header')] : []
				state.dashboardFrames.push({ path: location.pathname, count: headers.length, offsets: headers.map(header => header.getBoundingClientRect().top - inset!.getBoundingClientRect().top) })
				if (state.sampleDashboard) requestAnimationFrame(sample)
			}
			requestAnimationFrame(sample)
		})
		await page.getByRole('button', { name: destination, exact: true }).click()
		const path = destination === 'Marketplace' ? 'marketplace/starters' : destination.toLowerCase()
		await expect(page).toHaveURL(new RegExp(`/dashboard/${path}`))
		await expect(page.locator('.dashboard-content > header')).toBeVisible()
		await page.waitForTimeout(250)
		const result = await page.evaluate(() => {
			const state = window as any
			state.sampleDashboard = false
			return { documentId: state.dashboardDocumentId, frames: state.dashboardFrames ?? [] }
		})
		const transition = `${from} → ${destination}`
		expect.soft(result.frames.length, `${transition}: capture the navigation frames`).toBeGreaterThan(2)
		expect.soft(result.documentId, `${transition}: preserve the dashboard document`).toBe(documentId)
		expect.soft(result.frames.filter((frame: any) => frame.count !== 1 || frame.offsets.some((top: number) => Math.abs(top) > 1)), `${transition}: one stable header on every frame`).toEqual([])
		from = destination
	}
})

test('a populated Library does not flash an empty state while loading', async ({ page, request }) => {
	const { token } = await devAuth(request)
	const headers = { Authorization: `Bearer ${token}` }
	const groupResponse = await request.post('/api/collections/library_symbol_groups/records', { headers, data: { name: 'Loading check', index: 0 } })
	expect(groupResponse.ok()).toBe(true)
	const group = await groupResponse.json()
	const blockResponse = await request.post('/api/collections/library_symbols/records', { headers, data: { name: 'Loaded library block', group: group.id, html: '<p>Library block</p>', css: '', js: '' } })
	expect(blockResponse.ok()).toBe(true)
	await page.route('**/api/collections/library_symbol*/records*', async route => {
		await new Promise(resolve => setTimeout(resolve, 200))
		await route.continue()
	})
	await loginAsDeveloperAtDashboard(page)
	await expect(page.locator('.dashboard-content > header')).toBeVisible()
	await page.evaluate(() => {
		const state = window as any
		state.libraryLoadingText = []
		state.sampleLibraryLoading = true
		const sample = () => {
			state.libraryLoadingText.push(document.querySelector('.dashboard-content')?.textContent ?? '')
			if (state.sampleLibraryLoading) requestAnimationFrame(sample)
		}
		requestAnimationFrame(sample)
	})
	await page.getByRole('button', { name: 'Library', exact: true }).click()
	await page.getByRole('link', { name: 'Loading check', exact: true }).click()
	await expect(page.getByRole('button', { name: 'Loaded library block', exact: true })).toBeVisible()
	const emptyFrames = await page.evaluate(() => {
		const state = window as any
		state.sampleLibraryLoading = false
		return state.libraryLoadingText.filter((text: string) => /Build your block library|No blocks in this group/.test(text))
	})
	expect(emptyFrames, 'Loading an existing library must not claim it is empty').toEqual([])
})
