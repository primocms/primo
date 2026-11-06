import { test as base, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import yaml from 'js-yaml'
import { CLI_ENTRY, TEST_SERVER_URL, TEST_DATA_DIR } from './helpers/paths'
import { devAuth, ensureEditorUser } from './helpers/server'
import { stubExternalImages } from './helpers/editor'

// Reuse the CDN's original compiler bytes across page reloads. This tests
// editor behavior without fetching the same runtime hundreds of times.
const test = base.extend<{}, { auditContext: BrowserContext; auditPage: Page }>({
	auditContext: [
		async ({ browser }, use) => {
			const context = await browser.newContext()
			const cacheDirectory = path.join(os.tmpdir(), 'primo-client-audit-cdn-cache')
			fs.mkdirSync(cacheDirectory, { recursive: true })
			await context.route(/^https:\/\/(esm\.sh|fonts\.googleapis\.com|fonts\.gstatic\.com)\//, async (route) => {
				const key = createHash('sha256').update(route.request().url()).digest('hex')
				const file = path.join(cacheDirectory, `${key}.js`)
				const metadata = `${file}.json`
				if (!fs.existsSync(file) || !fs.existsSync(metadata)) {
					const response = await route.fetch()
					if (!response.ok()) {
						await route.fulfill({ response })
						return
					}
					const temporary = `${file}.${process.pid}`
					fs.writeFileSync(temporary, await response.body())
					fs.writeFileSync(`${metadata}.${process.pid}`, JSON.stringify({ contentType: response.headers()['content-type'] ?? 'application/javascript' }))
					fs.renameSync(`${metadata}.${process.pid}`, metadata)
					fs.renameSync(temporary, file)
				}
				const { contentType } = JSON.parse(fs.readFileSync(metadata, 'utf8'))
				await route.fulfill({ status: 200, contentType, headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(file) })
			})
			await use(context)
			await context.close()
		},
		{ scope: 'worker' }
	],
	auditPage: [async ({ auditContext }, use) => {
		const page = await auditContext.newPage()
		await stubExternalImages(page)
		await use(page)
		await page.close()
	}, { scope: 'worker' }],
	page: async ({ auditPage }, use) => use(auditPage)
})

// Opt-in audit of an exported client site. All mutations go to the E2E
// database, never to the source server. No client data is checked in.
const source = process.env.PRIMO_AUDIT_SITE_DIR
function pageFiles(directory: string): string[] {
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => (entry.isDirectory() ? pageFiles(path.join(directory, entry.name)) : entry.name.endsWith('.yaml') ? [path.join(directory, entry.name)] : []))
}
const pages = source
	? pageFiles(path.join(source, 'pages')).map((file) => {
			const data = yaml.load(fs.readFileSync(file, 'utf8')) as any
			const relative = path
				.relative(path.join(source, 'pages'), file)
				.replaceAll(path.sep, '/')
				.replace(/(^|\/)index\.yaml$/, '')
				.replace(/\.yaml$/, '')
			return { ...data, path: relative }
		})
	: []

test.describe('Exported client editor audit', () => {
	test.skip(!source, 'Set PRIMO_AUDIT_SITE_DIR to an exported site directory')
	if (process.env.PRIMO_AUDIT_PARALLEL) test.describe.configure({ mode: 'parallel' })
	let siteId: string
	let headers: Record<string, string>
	let editorAuth: { token: string; record: any }
	let sections: any[]
	let templateSections: any[]
	let types: any[]
	let symbols: any[]

	test.beforeAll(async ({ request }) => {
		test.setTimeout(180000)
		let token = ''
		async function create(collection: string, data: any) {
			const response = await request.post(`/api/collections/${collection}/records`, { headers, data })
			expect(response.ok(), await response.text()).toBeTruthy()
			return response.json()
		}
		const sourceKey = createHash('sha256').update(path.resolve(source!)).digest('hex').slice(0, 12)
		const stateFile = path.join(TEST_DATA_DIR, `client-audit-site-${sourceKey}.json`)
		const lock = `${stateFile}.lock`
		while (!fs.existsSync(stateFile)) {
			try {
				fs.mkdirSync(lock)
			} catch (error) {
				if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
				await new Promise((resolve) => setTimeout(resolve, 200))
				continue
			}
			try {
				if (fs.existsSync(stateFile)) continue
				;({ token } = await devAuth(request))
				headers = { Authorization: `Bearer ${token}` }

				const group = await create('site_groups', { name: `Isolated client audit ${Date.now()}`, index: 100 })
				const site = await create('sites', { name: 'Client audit', host: `audit-${Date.now()}`, group: group.id })
				siteId = site.id
				await request.patch(`/api/collections/sites/records/${siteId}`, { headers, data: { host: siteId } })
				const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'primo-client-audit-import-'))
				try {
					fs.cpSync(source!, temporary, { recursive: true })
					fs.writeFileSync(path.join(temporary, 'site.yaml'), `name: Isolated client audit\nsite_id: ${siteId}\n`)
					execFileSync(process.execPath, [CLI_ENTRY, 'push', '--server', TEST_SERVER_URL, '--site', siteId, '--dir', temporary, '-t', token, '--force', '--yes'], { stdio: 'pipe', timeout: 150000 })
				} finally {
					fs.rmSync(temporary, { recursive: true, force: true })
				}
				const editor = await ensureEditorUser(request, token, siteId)
				const login = await request.post('/api/collections/users/auth-with-password', { data: { identity: editor.email, password: editor.password } })
				expect(login.ok(), await login.text()).toBeTruthy()
				const auth = await login.json()
				fs.writeFileSync(stateFile, JSON.stringify({ siteId, auth }), { mode: 0o600 })
			} finally {
				fs.rmdirSync(lock)
			}
		}
		;({ token } = await devAuth(request))
		headers = { Authorization: `Bearer ${token}` }
		const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
		siteId = state.siteId
		editorAuth = state.auth
		async function list(collection: string, filter: string) {
			const records: any[] = []
			for (let page = 1; ; page++) {
				const response = await request.get(`/api/collections/${collection}/records`, { headers, params: { filter, perPage: 500, page } })
				expect(response.ok()).toBeTruthy()
				const result = await response.json()
				records.push(...result.items)
				if (page >= result.totalPages) return records
			}
		}
		types = await list('page_types', `site = "${siteId}"`)
		symbols = await list('site_symbols', `site = "${siteId}"`)
		sections = await list('page_sections', `page.site = "${siteId}"`)
		templateSections = await list('page_type_sections', `page_type.site = "${siteId}"`)
	})

	async function openEditor(page: Page, pagePath = '') {
		const destination = `/admin/sites/${siteId}${pagePath ? `/${pagePath}` : ''}`
		if (!page.url().startsWith(`${TEST_SERVER_URL}/admin/sites/${siteId}`)) {
			await page.addInitScript((auth) => window.localStorage.setItem('pocketbase_auth', JSON.stringify(auth)), editorAuth)
			await page.goto(destination, { waitUntil: 'domcontentloaded' })
			return
		}
		if (new URL(page.url()).pathname === destination) return
		// Follow the same page-tree links as a client. Keep one editor session
		// per worker, while still checking a hard reload after every saved edit.
		const dialog = page.getByRole('dialog').filter({ has: page.locator('.pages-heading') })
		if (!(await dialog.isVisible())) await page.getByRole('button', { name: 'Pages', exact: true }).click()
		const parts = pagePath.split('/').filter(Boolean)
		for (let depth = 1; depth < parts.length; depth++) {
			const parentPath = `/admin/sites/${siteId}/${parts.slice(0, depth).join('/')}`
			const row = dialog.locator('.page-item-container').filter({ has: page.locator(`a[href$="${parentPath}"]`) })
			const toggle = row.getByRole('button', { name: 'Toggle child pages', exact: true })
			await expect(toggle).toBeEnabled()
			if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
		}
		await dialog.locator(`a[href$="${destination}"]`).click()
		await expect(dialog).toBeHidden()
	}

	async function expectCanvas(page: Page) {
		await expect
			.poll(
				() =>
					page
						.locator('main iframe')
						.evaluateAll(
							(frames) =>
								frames.length > 0 && frames.every((frame) => !!(frame as HTMLIFrameElement).contentDocument?.body?.querySelector('header,footer,section,article,main,form,img,svg,h1,h2,p,iframe,a'))
						),
				{ timeout: 20000 }
			)
			.toBe(true)
		await expect(page.locator('main#Page')).toHaveClass(/\bfadein\b/, { timeout: 15000 })
	}

	async function linkDestinations(request: APIRequestContext, pageId: string) {
		const scopes = [
			['page_entries', `page = "${pageId}"`],
			['page_section_entries', `section.page = "${pageId}"`],
			['site_entries', `field.site = "${siteId}"`]
		]
		const records = (await Promise.all(scopes.map(async ([collection, scope]) => {
			const entries: any[] = []
			for (let page = 1; ; page++) {
				const response = await request.get(`/api/collections/${collection}/records`, { headers, params: { filter: `${scope} && field.type = "link"`, perPage: 500, page } })
				expect(response.ok()).toBeTruthy()
				const data = await response.json()
				entries.push(...data.items)
				if (page >= data.totalPages) return entries
			}
		}))).flat()
		return records
			.filter((entry) => entry.value?.page || entry.value?.url)
			.map((entry) => ({ key: `${entry.page ?? entry.section ?? siteId}:${entry.field}:${entry.parent ?? ''}`, page: entry.value.page ?? null, url: entry.value.url ?? '' }))
			.sort((a, b) => a.key.localeCompare(b.key))
	}

	test.afterEach(async ({ page }, info) => {
		if (info.status !== info.expectedStatus && !page.isClosed()) {
			await info.attach('Editor at failure', { body: await page.screenshot(), contentType: 'image/png' })
		}
		page.removeAllListeners('pageerror')
	})
	const picturedTypes = new Set<string>()

	for (const pageData of pages) {
		test(`${pageData.path || '/'}: render, inspect every section, edit, save and reload`, async ({ page, request }) => {
			test.setTimeout(90000)
			const errors: string[] = []
			page.on('pageerror', (error) => errors.push(error.message))
			const originalLinks = await linkDestinations(request, pageData._id)
			await openEditor(page, pageData.path)
			const ownSections = sections.filter((section) => section.page === pageData._id).sort((a, b) => a.index - b.index)
			const template = types.find((type) => type.name === (yaml.load(fs.readFileSync(path.join(source!, 'page-types', pageData.page_type, 'config.yaml'), 'utf8')) as any).name)
			const shared = templateSections.filter((section) => section.page_type === template.id && ['header', 'footer'].includes(section.zone))
			await expect(page.locator('[data-outline-id]')).toHaveCount(ownSections.length + shared.length, { timeout: 20000 })
			await expect(page.locator('.component-error')).toHaveCount(0)
			await expectCanvas(page)
			await expect(page.getByRole('tab', { name: 'Fields', exact: true })).toBeVisible()
			const malformedImages = await page
				.locator('main iframe')
				.evaluateAll((frames) =>
					frames.flatMap((frame) =>
						[...((frame as HTMLIFrameElement).contentDocument?.images ?? [])]
							.map((image) => image.getAttribute('src') ?? '')
							.filter((source) => source.startsWith('\\') || source.startsWith('"') || source.startsWith("'"))
					)
				)
			if (malformedImages.length)
				await test.info().attach('Malformed embedded image URLs', { body: JSON.stringify({ page: pageData.path, sources: malformedImages }, null, 2), contentType: 'application/json' })
			await page.getByRole('tab', { name: 'Fields', exact: true }).click()
			await expect(page.locator('.sidebar')).toContainText('Fields')
			await page.getByRole('tab', { name: 'Outline', exact: true }).click()
			let edited = false
			let editedSection = ''
			let editedValue = ''
			for (const section of ownSections) {
				await page.locator(`[data-outline-id="${section.id}"]`).hover()
				await page.locator(`[data-outline-id="${section.id}"] .edit-content`).click()
				const dialog = page.getByRole('dialog')
				await expect(dialog).toBeVisible()
				await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled({ timeout: 15000 })
				const text = dialog.locator('textarea:visible').first()
				if (!edited && (await text.count())) {
					const before = await text.inputValue()
					await text.fill(`${before} [client audit]`)
					edited = true
					editedSection = section.id
					editedValue = `${before} [client audit]`
				}
				await dialog.getByRole('button', { name: 'Save', exact: true }).click()
				await expect(dialog).toBeHidden()
			}
			if (edited) {
				await expect
					.poll(async () => {
						const values = await Promise.all([
							request.get('/api/collections/page_section_entries/records', { headers, params: { filter: `section.page = "${pageData._id}"`, perPage: 500 } }),
							request.get('/api/collections/page_entries/records', { headers, params: { filter: `page = "${pageData._id}"`, perPage: 500 } })
						])
						return JSON.stringify(await Promise.all(values.map(async (response) => (await response.json()).items)))
					})
					.toContain('[client audit]')
			}
			await page.reload({ waitUntil: 'domcontentloaded' })
			await expect(page.locator('[data-outline-id]')).toHaveCount(ownSections.length + shared.length, { timeout: 20000 })
			await expect(page.locator('.component-error')).toHaveCount(0)
			await expectCanvas(page)
			if (editedSection) {
				await page.locator(`[data-outline-id="${editedSection}"]`).hover()
				await page.locator(`[data-outline-id="${editedSection}"] .edit-content`).click()
				const dialog = page.getByRole('dialog')
				await expect(dialog.locator('textarea:visible').first()).toHaveValue(editedValue)
				await dialog.getByRole('button', { name: 'Save', exact: true }).click()
				await expect(dialog).toBeHidden()
			}
			expect(await linkDestinations(request, pageData._id), 'Unrelated content edits must preserve link destinations').toEqual(originalLinks)
			expect(errors).toEqual([])
			if (!picturedTypes.has(pageData.page_type)) {
				await test.info().attach(`${pageData.page_type} editor`, { body: await page.screenshot(), contentType: 'image/png' })
				picturedTypes.add(pageData.page_type)
			}
		})
	}

	test('each page type creates its default body sections through the client UI', async ({ page, request }) => {
		test.setTimeout(240000)
		await openEditor(page)
		await page.getByRole('button', { name: 'Pages', exact: true }).click()
		const dialog = page.getByRole('dialog')
		for (const type of types) {
			const name = `Audit ${type.name} ${Date.now()}`
			await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
			await dialog.getByLabel('Page name', { exact: true }).fill(name)
			const select = dialog.locator('.Select', { hasText: 'Page Type' })
			await select.locator('button.primary').click()
			await select.locator('.popup .options').getByRole('button', { name: type.name, exact: true }).click()
			await dialog.getByRole('button', { name: 'Create page', exact: true }).click()
			await expect(dialog.getByRole('link', { name: name, exact: true })).toBeVisible({ timeout: 30000 })
			const response = await request.get('/api/collections/pages/records', { headers, params: { filter: `site = "${siteId}" && name = "${name}"` } })
			const created = (await response.json()).items[0]
			const sectionResponse = await request.get('/api/collections/page_sections/records', { headers, params: { filter: `page = "${created.id}"`, sort: 'index' } })
			const expected = templateSections.filter((s) => s.page_type === type.id && !['header', 'footer'].includes(s.zone)).sort((a, b) => a.index - b.index)
			const createdSections = (await sectionResponse.json()).items
			expect(createdSections.map((s) => s.symbol)).toEqual(expected.map((s) => s.symbol))
			await dialog.getByRole('link', { name, exact: true }).click()
			await expect(dialog).toBeHidden()
			await page.getByRole('tab', { name: 'Outline', exact: true }).click()
			const shared = templateSections.filter((s) => s.page_type === type.id && ['header', 'footer'].includes(s.zone))
			await expect(page.locator('[data-outline-id]')).toHaveCount(createdSections.length + shared.length, { timeout: 20000 })
			for (const section of createdSections) await expect(page.locator(`[data-outline-id="${section.id}"]`)).toBeVisible()
			await expectCanvas(page)
			if (type.name === 'Story') {
				await page.getByRole('tab', { name: 'Fields', exact: true }).click()
				await page.getByRole('textbox', { name: 'Title', exact: true }).fill(name)
				await expect.poll(async () => {
					const response = await request.get('/api/collections/page_entries/records', { headers, params: { filter: `page = "${created.id}" && field.key = "title"` } })
					return (await response.json()).items[0]?.value
				}).toBe(name)
				await page.reload({ waitUntil: 'domcontentloaded' })
				await page.getByRole('tab', { name: 'Fields', exact: true }).click()
				await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(name)
				await page.getByRole('tab', { name: 'Outline', exact: true }).click()
				await expectCanvas(page)
				await test.info().attach('New Story editor', { body: await page.screenshot(), contentType: 'image/png' })
			}
			await page.getByRole('button', { name: 'Pages', exact: true }).click()
		}
	})

	test('Story image upload, description and position persist through the client Fields panel', async ({ page, request }) => {
		test.setTimeout(90000)
		const story = pages.find((page) => page.page_type === 'news')
		test.skip(!story, 'This site has no Story pages')
		await openEditor(page, story.path)
		await page.getByRole('tab', { name: 'Outline', exact: true }).click()
		const header = sections.filter((section) => section.page === story._id).sort((a, b) => a.index - b.index)[0]
		await page.locator(`[data-outline-id="${header.id}"]`).hover()
		await page.locator(`[data-outline-id="${header.id}"] .edit-content`).click()
		const storyContent = page.getByRole('dialog')
		await storyContent.getByRole('textbox', { name: 'Title (from page)', exact: true }).fill('Client audit story title')
		await storyContent.getByRole('button', { name: 'Save', exact: true }).click()
		await expect(storyContent).toBeHidden()
		await page.getByRole('tab', { name: 'Fields', exact: true }).click()
		await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Client audit story title')
		const date = page.locator('.page-type-fields input[type="date"]')
		await date.fill('2026-10-22')
		await page.getByRole('textbox', { name: 'SEO Title', exact: true }).fill('Client audit SEO title')
		await page.getByRole('textbox', { name: 'SEO Description', exact: true }).fill('Client audit SEO description')
		await expect.poll(async () => {
			const response = await request.get('/api/collections/page_entries/records', { headers, params: { filter: `page = "${story._id}" && field.key = "seo_description"` } })
			return (await response.json()).items[0]?.value
		}).toBe('Client audit SEO description')
		const image = page.locator('.page-type-fields .ImageField').first()
		await image.locator('input[type="file"]').setInputFiles({
			name: 'client-audit.png',
			mimeType: 'image/png',
			buffer: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAkElEQVR4nO3RMREAIBDAsJeIJjThD2TQIUP23nXOXpeO+R2AIWmGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0jMA8FGOIiljfewAAAAAElFTkSuQmCC',
				'base64'
			)
		})
		async function saved() {
			const response = await request.get('/api/collections/page_entries/records', { headers, params: { filter: `page = "${story._id}" && field.key = "image"` } })
			return (await response.json()).items[0]?.value
		}
		await expect.poll(async () => (await saved())?.width).toBe(100)
		await image.getByLabel('Description', { exact: true }).fill('Client audit image description')
		await expect.poll(async () => (await saved())?.alt).toBe('Client audit image description')
		const upload = (await saved()).upload
		expect(upload).toBeTruthy()
		await image.getByRole('button', { name: 'Position', exact: true }).click()
		const dialog = page.getByRole('dialog')
		await dialog.getByRole('button', { name: /Focus point at/ }).press('ArrowRight')
		await dialog.getByRole('button', { name: 'Close position editor', exact: true }).click()
		await expect.poll(async () => (await saved())?.focal_point?.x).toBe(0.51)
		expect((await saved()).upload).toBe(upload)
		await page.reload({ waitUntil: 'domcontentloaded' })
		await page.getByRole('tab', { name: 'Fields', exact: true }).click()
		await expect(date).toHaveValue('2026-10-22')
		await expect(page.getByRole('textbox', { name: 'SEO Title', exact: true })).toHaveValue('Client audit SEO title')
		await expect(page.getByRole('textbox', { name: 'SEO Description', exact: true })).toHaveValue('Client audit SEO description')
		await expect(image.getByLabel('Description', { exact: true })).toHaveValue('Client audit image description')
		expect((await saved()).upload).toBe(upload)
	})

	test('Story blocks can be added, reordered and removed through client controls', async ({ page, request }) => {
		test.setTimeout(120000)
		await page.emulateMedia({ reducedMotion: 'reduce' })
		const story = pages.find((page) => page.page_type === 'news')
		test.skip(!story, 'This site has no Story pages')
		const symbol = symbols.find((symbol) => symbol.name === 'Rich Content')
		expect(symbol).toBeTruthy()
		async function body() {
			const response = await request.get('/api/collections/page_sections/records', { headers, params: { filter: `page = "${story._id}"`, sort: 'index' } })
			expect(response.ok()).toBeTruthy()
			return (await response.json()).items as any[]
		}
		const before = await body()
		await openEditor(page, story.path)
		await expectCanvas(page)
		await page.getByRole('tab', { name: 'Blocks', exact: true }).click()
		const card = page.locator(`.sidebar [data-test-id="symbol-${symbol.id}"]`)
		await card.scrollIntoViewIfNeeded()
		await expect(card).toHaveAttribute('draggable', 'true')
		const start = (await card.boundingBox())!
		const canvas = (await page.locator('main#Page').boundingBox())!
		await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
		await page.mouse.down()
		await page.mouse.move(start.x + start.width / 2 + 16, start.y + start.height / 2, { steps: 4 })
		await expect(page.locator('main#Page')).toHaveClass(/\bdragging\b/)
		await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2, { steps: 12 })
		await page.mouse.move(canvas.x + canvas.width / 2 + 2, canvas.y + canvas.height / 2, { steps: 3 })
		await page.mouse.up()
		await expect.poll(async () => (await body()).length).toBe(before.length + 1)
		const added = (await body()).find((section) => !before.some((old) => old.id === section.id))!
		expect(added.symbol).toBe(symbol.id)
		await page.getByRole('tab', { name: 'Outline', exact: true }).click()
		const order = await body()
		const moveToEnd = order[0].id === added.id
		const target = moveToEnd ? order.at(-1)! : order[0]
		const row = (id: string) => page.locator(`[data-outline-id="${id}"]`)
		await expect(row(added.id).locator('button.drag')).toHaveAttribute('draggable', 'true')
		await row(added.id).hover()
		await row(added.id).locator('.edit-content').click()
		const content = page.getByRole('dialog')
		await content.locator('.ProseMirror[contenteditable="true"]').fill('Client audit added block content')
		await content.getByRole('button', { name: 'Save', exact: true }).click()
		await expect(content).toBeHidden()
		await expect.poll(async () => {
			const response = await request.get('/api/collections/page_section_entries/records', { headers, params: { filter: `section = "${added.id}" && field.key = "body"` } })
			return JSON.stringify((await response.json()).items)
		}).toContain('Client audit added block content')
		const sourceBox = (await row(added.id).locator('button.drag').boundingBox())!
		const targetBox = (await row(target.id).boundingBox())!
		await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
		await page.mouse.down()
		await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 8, sourceBox.y + sourceBox.height / 2, { steps: 4 })
		await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + (moveToEnd ? targetBox.height - 3 : 3), { steps: 12 })
		await page.mouse.up()
		const expected = order.filter((section) => section.id !== added.id).map((section) => section.id)
		if (moveToEnd) expected.push(added.id)
		else expected.unshift(added.id)
		await expect.poll(async () => (await body()).map((section) => section.id)).toEqual(expected)

		async function blockActions() {
			await expect(row(added.id).locator('button.drag')).toHaveAttribute('draggable', 'true')
			await row(added.id).locator('button.select').click()
			await page.locator(`main [data-section="${added.id}"]`).hover()
			await page.getByLabel('More block actions', { exact: true }).click()
		}
		await blockActions()
		await expect(page.getByRole('button', { name: moveToEnd ? 'Move up' : 'Move down', exact: true })).toBeVisible({ timeout: 10000 })
		await page.getByRole('button', { name: moveToEnd ? 'Move up' : 'Move down', exact: true }).click()
		const oldPosition = expected.indexOf(added.id)
		const nextPosition = oldPosition + (moveToEnd ? -1 : 1)
		expected.splice(oldPosition, 1)
		expected.splice(nextPosition, 0, added.id)
		await expect.poll(async () => (await body()).map((section) => section.id)).toEqual(expected)
		await blockActions()
		await page.getByRole('button', { name: 'Delete block', exact: true }).click()
		await expect.poll(async () => (await body()).map((section) => section.id)).toEqual(before.map((section) => section.id))
		const entries = await request.get('/api/collections/page_section_entries/records', { headers, params: { filter: `section = "${added.id}"` } })
		expect((await entries.json()).items).toEqual([])
		await page.reload({ waitUntil: 'domcontentloaded' })
		await expect(row(added.id)).toHaveCount(0)
		await expectCanvas(page)
	})
})
