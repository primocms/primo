import type { Page, Locator, FrameLocator } from '@playwright/test'
import { expect } from '@playwright/test'
import { TEST_SERVER_URL } from './paths'

const TRANSPARENT_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

/** Serves every remote image request from the harness instead of the
 * public internet. The fixture content (and the image dialog's own test
 * input) deliberately keep real Unsplash URLs, because what those tests
 * assert is the URL *value* round-tripping through the CMS — but
 * page.goto()/page.reload() wait for the load event, which waits on
 * <img> requests, so an actually-fetched slow or unreachable Unsplash
 * response would burn the test timeout for reasons unrelated to the
 * product. Intercepting keeps the asserted URLs intact while making the
 * suite independent of external network access. Covers the canvas iframe
 * too: page.route applies to every frame in the page. */
export async function stubExternalImages(page: Page) {
	await page.route('https://images.unsplash.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG }))
}

/** Navigates directly to a specific seeded site's editor (by id, via
 * /admin/sites/[site_id]) as the localhost dev-auth "developer" account.
 *
 * Deliberately does NOT go through /admin/auth's client-triggered
 * dev-auth handshake: that flow always redirects to bare /admin/site
 * afterward (src/routes/auth/+layout.svelte onMount), whose own onMount
 * then redirects AGAIN to whatever site getList(1,1) returns first and
 * opens it via site_editor_url() — for an "unassigned" site (host === id)
 * that's meant to resolve to /admin/sites/{id}, but with several sites
 * freshly created back-to-back on the shared test server this
 * intermediate hop was observed landing on a bare, unresolvable hostname
 * (net::ERR_NAME_NOT_RESOLVED) instead, likely a client-side read winning
 * a race against the host-unassignment PATCH. Fetching a dev-auth token
 * directly and seeding the SDK's LocalAuthStore format before the first
 * paint (same technique as loginAs) sidesteps that whole redirect chain:
 * check_session() passes immediately and /admin/sites/{siteId} loads with
 * no intermediate hop at all. */
export async function loginAsDeveloper(page: Page, siteId: string) {
	await stubExternalImages(page)
	const res = await page.request.post(`${TEST_SERVER_URL}/api/primo/dev-auth`)
	if (!res.ok()) throw new Error(`dev-auth failed: ${res.status()} ${await res.text()}`)
	const { token, record } = await res.json()

	await page.addInitScript(
		([storageKey, token, record]) => {
			window.localStorage.setItem(storageKey as string, JSON.stringify({ token, record }))
		},
		['pocketbase_auth', token, record]
	)
	await page.goto(`${TEST_SERVER_URL}/admin/sites/${siteId}`)
	await expect(page).toHaveURL(new RegExp(`/admin/sites/${siteId}`), { timeout: 15000 })
}

/** Same dev-auth technique as loginAsDeveloper, but lands on the site
 * dashboard (/admin/dashboard/sites) instead of a specific site's editor —
 * for flows that start before any site exists in the test's context, like
 * creating a new site from scratch. */
export async function loginAsDeveloperAtDashboard(page: Page) {
	await stubExternalImages(page)
	const res = await page.request.post(`${TEST_SERVER_URL}/api/primo/dev-auth`)
	if (!res.ok()) throw new Error(`dev-auth failed: ${res.status()} ${await res.text()}`)
	const { token, record } = await res.json()

	await page.addInitScript(
		([storageKey, token, record]) => {
			window.localStorage.setItem(storageKey as string, JSON.stringify({ token, record }))
		},
		['pocketbase_auth', token, record]
	)
	await page.goto(`${TEST_SERVER_URL}/admin/dashboard/sites`)
	await expect(page).toHaveURL(/\/admin\/dashboard\/sites/, { timeout: 15000 })
}

/** Logs in as a specific user by directly authenticating against PocketBase
 * and seeding the SDK's default LocalAuthStore format
 * (localStorage['pocketbase_auth'] = {token, record}) before the app boots.
 * Necessary because on localhost the auth layout's own onMount immediately
 * fires dev-auth and redirects, so the real sign-in form is unreachable in
 * this dev-mode test environment — this reproduces what a successful
 * sign-in leaves behind without racing that redirect.
 *
 * Must be given a page that hasn't already been logged in as someone
 * else: addInitScript registrations accumulate on a page and Playwright
 * does not define their evaluation order, so a second login on the same
 * page leaves it non-deterministic which account's token the next
 * navigation ends up storing. Use a fresh page/context per identity. */
export async function loginAs(page: Page, email: string, password: string, siteId: string) {
	await stubExternalImages(page)
	const res = await page.request.post(`${TEST_SERVER_URL}/api/collections/users/auth-with-password`, {
		data: { identity: email, password }
	})
	if (!res.ok()) throw new Error(`login failed for ${email}: ${res.status()} ${await res.text()}`)
	const { token, record } = await res.json()

	await page.addInitScript(
		([storageKey, token, record]) => {
			window.localStorage.setItem(storageKey as string, JSON.stringify({ token, record }))
		},
		['pocketbase_auth', token, record]
	)
	await page.goto(`${TEST_SERVER_URL}/admin/sites/${siteId}`)
	await expect(page).toHaveURL(new RegExp(`/admin/sites/${siteId}`), { timeout: 15000 })
}

/** The canvas iframe rendering the page's sections (not the block-library
 * preview iframe in the sidebar). */
export function canvasFrame(page: Page): FrameLocator {
	return page.locator('main iframe').first().contentFrame()
}

/** Replaces the text of a contentEditable element by clicking it,
 * select-all + backspace, then typing the new value — retrying the whole
 * sequence if the keystrokes don't land. The canvas iframe's click
 * handlers (set_editable_text in ComponentNode.svelte) are wired up
 * asynchronously after mount; a click that arrives just before they're
 * attached is silently swallowed with nothing else to signal the miss, so
 * a single attempt is occasionally flaky right after the canvas becomes
 * visible. */
export async function replaceContentEditableText(page: Page, locator: Locator, newText: string) {
	await expect(async () => {
		await locator.click()
		await page.keyboard.press('ControlOrMeta+A')
		await page.keyboard.press('Backspace')
		await page.keyboard.type(newText)
		await expect(locator).toHaveText(newText, { timeout: 1000 })
	}).toPass({ timeout: 10000 })
}

/** Opens the block's "Edit Block Content" modal (code editor + data/fields
 * panel) by hovering the given canvas element to reveal the block toolbar. */
export async function openBlockContentModal(page: Page, canvasElementLocator: ReturnType<FrameLocator['locator']>) {
	await canvasElementLocator.hover()
	await page.getByRole('button', { name: 'Edit Block Content' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog.locator('.RepeaterField')).toBeVisible({ timeout: 10000 })
	return dialog
}

// Note: there is no standalone API-only publish helper here. POST
// /api/primo/generate alone 404s on a page whose compiled_html is still
// empty (internal/generate.go's copyIfChanged stats an empty-suffixed
// key) — the client compiles each page and uploads compiled_html via
// Pages.update() *before* calling generate (src/lib/workers/Publish.svelte.ts).
// Use the real "Preview"/"Publish" toolbar button (see publishing.spec.ts's
// publishViaUI) to exercise the actual flow instead of half-reimplementing
// client-side compilation here.
