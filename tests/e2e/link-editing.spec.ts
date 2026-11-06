import { test, expect } from '@playwright/test'
import { loginAsDeveloper, canvasFrame, openBlockContentModal } from './helpers/editor'
import { devAuth, SERVER_URL } from './helpers/server'
import { seedFixtureSite } from './helpers/seed'

test('optional links stay empty on unrelated saves, and link controls edit independently', async ({ page, request }) => {
	test.setTimeout(60000)
	const { token } = await devAuth(request)
	const ids = await seedFixtureSite(token, 'Optional links')
	const headers = { Authorization: `Bearer ${token}` }
	async function create(collection: string, data: any) {
		const response = await request.post(`${SERVER_URL}/api/collections/${collection}/records`, { headers, data })
		expect(response.ok(), await response.text()).toBeTruthy()
		return response.json()
	}
	const optional = await create('site_symbol_fields', { symbol: ids.symbolId, key: 'optional_link', label: 'Optional call to action', type: 'link', index: 5 })
	const external = await create('site_symbol_fields', { symbol: ids.symbolId, key: 'external_link', label: 'External call to action', type: 'link', index: 6 })
	const empty = { label: '', url: '' }
	const optionalEntry = await create('page_section_entries', { section: ids.sectionId, field: optional.id, value: empty, index: 0, locale: 'en' })
	const externalEntry = await create('page_section_entries', { section: ids.sectionId, field: external.id, value: { label: 'Original link', url: 'https://example.com/original' }, index: 0, locale: 'en' })
	async function value(id: string) {
		const response = await request.get(`${SERVER_URL}/api/collections/page_section_entries/records/${id}`, { headers })
		return (await response.json()).value
	}
	await loginAsDeveloper(page, ids.siteId)
	const headline = canvasFrame(page).locator('[data-testid="headline"]')
	let dialog = await openBlockContentModal(page, headline)
	await dialog.getByRole('textbox', { name: 'Headline', exact: true }).fill('Unrelated content change')
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog).toBeHidden()
	expect(await value(optionalEntry.id)).toEqual(empty)

	dialog = await openBlockContentModal(page, headline)
	const optionalLabel = dialog.getByRole('textbox', { name: 'Optional call to action', exact: true })
	const externalLabel = dialog.getByRole('textbox', { name: 'External call to action', exact: true })
	const optionalControl = dialog.locator('.Link').filter({ has: page.getByRole('textbox', { name: 'Optional call to action', exact: true }) })
	const externalControl = dialog.locator('.Link').filter({ has: page.getByRole('textbox', { name: 'External call to action', exact: true }) })
	await expect(optionalControl.getByText('Choose a page', { exact: true })).toBeVisible()
	await optionalLabel.fill('Learn more')
	await externalLabel.fill('Updated external link')
	const url = externalControl.locator('input[type="url"]')
	await url.fill('')
	await expect(url).toBeVisible()
	await url.fill('https://example.com/updated')
	await optionalControl.getByText('Choose a page', { exact: true }).click()
	await optionalControl.locator('.popup .options').getByRole('button', { name: 'Home', exact: true }).click()
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog).toBeHidden()
	expect(await value(optionalEntry.id)).toMatchObject({ label: 'Learn more', page: ids.pageId })
	expect(await value(externalEntry.id)).toMatchObject({ label: 'Updated external link', url: 'https://example.com/updated' })
	await page.reload()
	dialog = await openBlockContentModal(page, canvasFrame(page).locator('[data-testid="headline"]'))
	await expect(dialog.getByRole('textbox', { name: 'Optional call to action', exact: true })).toHaveValue('Learn more')
	await expect(dialog.getByRole('textbox', { name: 'External call to action', exact: true })).toHaveValue('Updated external link')
	const restoredExternal = dialog.locator('.Link').filter({ has: page.getByRole('textbox', { name: 'External call to action', exact: true }) })
	await expect(restoredExternal.locator('input[type="url"]')).toHaveValue('https://example.com/updated')
	await restoredExternal.locator('input[type="url"]').fill('mailto:hello@example.com')
	await restoredExternal.locator('input[type="url"]').blur()
	await expect(restoredExternal.locator('input[type="url"]')).toHaveValue('mailto:hello@example.com')
	await dialog.getByRole('button', { name: 'Save', exact: true }).click()
	await expect(dialog).toBeHidden()
	expect(await value(externalEntry.id)).toMatchObject({ label: 'Updated external link', url: 'mailto:hello@example.com' })
})
