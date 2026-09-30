import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { TEST_SERVER_URL, CLI_ENTRY } from './helpers/paths'
import { loginAsDeveloper, canvasFrame, replaceContentEditableText } from './helpers/editor'
import { devAuth } from './helpers/server'
import { seedFixtureSite, type SeededSite } from './helpers/seed'

let ids: SeededSite
const PULL_DIR = '/tmp/primo-e2e-cli-pull'
const REPULL_DIR = '/tmp/primo-e2e-cli-repull'
let siteDir: string
let stalePushOutput = ''
let stalePushRejected = false
let componentPath: string
let cmsEditedHeadline: string
let afterHeadlineEntry: { value: string } | undefined
let symbolCss: string

test.describe('CLI round trip', () => {
	test.beforeAll(async ({ browser, request }) => {
		fs.rmSync(PULL_DIR, { recursive: true, force: true })
		fs.rmSync(REPULL_DIR, { recursive: true, force: true })
		const { token } = await devAuth(request)
		ids = await seedFixtureSite(token, 'CLI Roundtrip Fixture')

		const page = await browser.newPage()
		await loginAsDeveloper(page, ids.siteId)

		// --- establish baseline: pull the fixture as a developer would ---
		// `pull` fetches every site on the server into one workspace, so
		// locate our seeded site's folder by matching site_id in its
		// site.yaml rather than assuming a fixed slug.
		execFileSync('node', [CLI_ENTRY, 'pull', TEST_SERVER_URL, PULL_DIR, '-t', token], { stdio: 'inherit' })
		const sitesRoot = path.join(PULL_DIR, 'sites')
		const siteFolder = fs
			.readdirSync(sitesRoot)
			.find((name) => {
				const cfgPath = path.join(sitesRoot, name, 'site.yaml')
				return fs.existsSync(cfgPath) && fs.readFileSync(cfgPath, 'utf8').includes(ids.siteId)
			})
		expect(siteFolder).toBeTruthy()
		siteDir = path.join(sitesRoot, siteFolder!)
		componentPath = path.join(siteDir, 'blocks', 'content-block', 'component.svelte')
		expect(fs.existsSync(componentPath)).toBe(true)

		// --- CMS content edit, made via the real UI after the pull ---
		// The CLI pull above runs synchronously for a couple of seconds;
		// reload to make sure we're interacting with a settled page rather
		// than one mid-transition from whatever state the long synchronous
		// call left the tab in.
		await page.reload()
		const frame = canvasFrame(page)
		const headline = frame.locator('[data-testid="headline"]')
		await expect(headline).toBeVisible({ timeout: 15000 })
		await expect(headline).toHaveText('Original Headline', { timeout: 10000 })
		cmsEditedHeadline = `CMS Edit After Pull ${Date.now()}`
		await replaceContentEditableText(page, headline, cmsEditedHeadline)
		// Register the listener BEFORE blur(), which is what triggers the
		// save: waitForResponse only matches responses that arrive after
		// it starts listening, so registering it afterward can miss a fast
		// save and time out on content that was in fact persisted.
		const savePromise = page.waitForResponse(
			(res) => res.url().includes('/api/collections/page_section_entries/records/') && res.request().method() === 'PATCH',
			{ timeout: 5000 }
		)
		await headline.blur()
		const saveRes = await savePromise
		expect(saveRes.ok()).toBeTruthy()
		await page.close()

		// confirm it actually persisted server-side before touching the CLI
		const beforePushRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
			headers: { Authorization: `Bearer ${token}` },
			params: { filter: `section = "${ids.sectionId}"` }
		})
		const beforePushEntries = (await beforePushRes.json()).items
		const beforeHeadlineEntry = beforePushEntries.find((e: any) => e.field === ids.fieldIds.headline)
		expect(beforeHeadlineEntry.value).toBe(cmsEditedHeadline)

		// --- unrelated local styling change, made to the PULLED files ---
		const originalComponent = fs.readFileSync(componentPath, 'utf8')
		const styledComponent = originalComponent.replace('padding: 2rem;', 'padding: 2rem;\n\t\tbackground: hotpink;')
		expect(styledComponent).not.toBe(originalComponent) // sanity: the replace actually matched
		fs.writeFileSync(componentPath, styledComponent)

		// --- push from the stale pull. The push guard (primo#1263, CLI 0.2.0)
		// must refuse: the server changed since this copy was pulled. ---
		try {
			execFileSync('node', [CLI_ENTRY, 'push', '-t', token], { cwd: siteDir, encoding: 'utf8', stdio: 'pipe' })
		} catch (error: any) {
			stalePushRejected = true
			stalePushOutput = `${error.stdout ?? ''}${error.stderr ?? ''}`
		}

		// --- the supported recovery: pull fresh, redo the local change, push ---
		execFileSync('node', [CLI_ENTRY, 'pull', TEST_SERVER_URL, REPULL_DIR, '-t', token], { stdio: 'inherit' })
		const repulledSite = path.join(REPULL_DIR, 'sites', path.basename(siteDir))
		const repulledComponent = path.join(repulledSite, 'blocks', 'content-block', 'component.svelte')
		const freshComponent = fs.readFileSync(repulledComponent, 'utf8')
		const restyled = freshComponent.replace('padding: 2rem;', 'padding: 2rem;\n\t\tbackground: hotpink;')
		expect(restyled).not.toBe(freshComponent)
		fs.writeFileSync(repulledComponent, restyled)
		execFileSync('node', [CLI_ENTRY, 'push', '-t', token], { cwd: repulledSite, stdio: 'inherit' })

		// --- capture what happened to the CMS content edit ---
		const afterPushRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_sections/records`, {
			headers: { Authorization: `Bearer ${token}` },
			params: { filter: `page = "${ids.pageId}"` }
		})
		const afterSections = (await afterPushRes.json()).items
		expect(afterSections.length).toBe(1)
		const currentSectionId = afterSections[0].id

		const afterEntriesRes = await request.get(`${TEST_SERVER_URL}/api/collections/page_section_entries/records`, {
			headers: { Authorization: `Bearer ${token}` },
			params: { filter: `section = "${currentSectionId}"` }
		})
		const afterEntries = (await afterEntriesRes.json()).items
		afterHeadlineEntry = afterEntries.find((e: any) => e.field === ids.fieldIds.headline)

		console.log(
			`primo push result: expected headline "${cmsEditedHeadline}", got "${afterHeadlineEntry?.value}". ` +
				`Section id ${currentSectionId === ids.sectionId ? 'unchanged but entries recreated' : `changed from ${ids.sectionId} to ${currentSectionId}`}.`
		)

		// --- capture whether the unrelated styling edit made it to the server ---
		const symbolRes = await request.get(`${TEST_SERVER_URL}/api/collections/site_symbols/records`, {
			headers: { Authorization: `Bearer ${token}` },
			params: { filter: `site = "${ids.siteId}"` }
		})
		const symbol = (await symbolRes.json()).items[0]
		symbolCss = symbol.css
	})

	// Formerly a documented known bug (test.fail): a push from a stale pull
	// silently overwrote the CMS edit. The push guard now refuses that push.
	test('a push from a stale pull is refused instead of overwriting the CMS edit', async () => {
		expect(stalePushRejected).toBe(true)
		expect(stalePushOutput).toContain('changed on the server')
	})

	test('after pulling again, the CMS content edit survives the push', async () => {
		expect(afterHeadlineEntry?.value).toBe(cmsEditedHeadline)
	})

	// Kept as a SEPARATE, normally-enforced test (not folded into the test
	// above) so a genuine regression here can't hide behind the known-bug
	// test.fail() on the assertion above.
	test('primo push does propagate unrelated local file changes (styling) to the server', async () => {
		expect(symbolCss).toContain('hotpink')
	})
})
