import { test, expect } from '@playwright/test'
import { loginAsDeveloper, loginAsDeveloperAtDashboard, canvasFrame } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

test('mobile editor keeps its canvas and sidebar usable across viewport changes', async ({ page, request }) => {
	test.setTimeout(60000)
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Mobile layout')
	await page.setViewportSize({ width: 390, height: 844 })
	await loginAsDeveloper(page, ids.siteId)
	await expect(canvasFrame(page).locator('[data-testid="headline"]')).toBeVisible()
	await page.getByRole('button', { name: 'Show sidebar', exact: true }).click()
	await expect(page.getByRole('tab', { name: 'Outline', exact: true })).toBeVisible()
	await page.getByRole('button', { name: 'Hide sidebar', exact: true }).click()
	await expect(page.locator('.editor-sidebar')).toBeHidden()
	await page.setViewportSize({ width: 1280, height: 800 })
	await expect(page.getByRole('tab', { name: 'Outline', exact: true })).toBeVisible()
	await expect(page.locator('.mobile-sidebar-bar')).toBeHidden()
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('the mobile dashboard exposes working local-development instructions', async ({ page, request }) => {
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Develop locally')
	const site = await (await request.get(`/api/collections/sites/records/${ids.siteId}`, { headers: { Authorization: token } })).json()
	await page.setViewportSize({ width: 390, height: 844 })
	await loginAsDeveloperAtDashboard(page, site.group)
	await page.getByRole('button', { name: 'Develop locally', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog.getByRole('heading', { name: 'Develop locally', exact: true })).toBeVisible()
	await expect(dialog.getByRole('button', { name: /primo pull -s http/ })).toBeVisible()
	const box = await dialog.boundingBox()
	expect(box!.x).toBeGreaterThanOrEqual(0)
	expect(box!.x + box!.width).toBeLessThanOrEqual(391)
	await dialog.getByRole('button', { name: 'Okay', exact: true }).click()
	await expect(dialog).toBeHidden()
})
