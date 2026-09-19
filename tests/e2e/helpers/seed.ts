import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { CLI_ENTRY, FIXTURE_SITE_DIR, TEST_SERVER_URL } from './paths'

export interface SeededSite {
	siteId: string
	pageId: string
	sectionId: string
	symbolId: string
	fieldIds: Record<string, string>
}

function randomSiteId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
	let id = ''
	for (let i = 0; i < 15; i++) id += chars[Math.floor(Math.random() * chars.length)]
	return id
}

let cachedGroupId: string | null = null

/** The sites collection requires a group; reuse one group per test run
 * rather than creating a fresh one per site. */
async function ensureSiteGroup(headers: Record<string, string>): Promise<string> {
	if (cachedGroupId) return cachedGroupId
	const listRes = await fetch(`${TEST_SERVER_URL}/api/collections/site_groups/records`, { headers })
	const existing = (await listRes.json()).items
	if (existing.length > 0) {
		cachedGroupId = existing[0].id
		return cachedGroupId
	}
	const createRes = await fetch(`${TEST_SERVER_URL}/api/collections/site_groups/records`, {
		method: 'POST',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: 'Default', index: 0 })
	})
	const created = await createRes.json()
	cachedGroupId = created.id
	return cachedGroupId
}

/** Seeds a fresh, isolated copy of the fixture-site content under a
 * brand-new site record, so each spec file gets its own site on the
 * shared test server with no cross-test content interference.
 *
 * `primo push`'s bootstrap path (used when a site doesn't exist yet) is
 * only available while the server has zero sites (see push.ts /
 * bootstrap.go) — every site after the first must already exist as a
 * `sites` record before push's normal /api/primo/import/{site_id}
 * endpoint will accept it. So: create the sites record directly via the
 * PocketBase API first (with a unique host so it doesn't collide with
 * other seeded sites), then push content into it. */
export async function seedFixtureSite(devToken: string, siteName: string): Promise<SeededSite> {
	const headers = { Authorization: `Bearer ${devToken}` }
	const groupId = await ensureSiteGroup(headers)

	// `host` has a UNIQUE index and is required at create time, but we want
	// the final host to be the "unassigned" sentinel (host === id — see
	// is_host_assigned in src/lib/site_host.ts) so the editor treats this
	// like a normal unassigned-host pushed site instead of routing through
	// assigned-custom-domain logic (which redirected the test browser to
	// the literal unresolvable hostname and broke navigation). Create with
	// a throwaway unique host, then patch host = id once the real id is known.
	//
	// sites also has a UNIQUE(name, group) index. `beforeAll` has been
	// observed invoking this helper more than once for the same describe
	// block in a single run (root cause not pinned down — possibly
	// Playwright re-running a worker-scoped hook after an unrelated
	// in-file failure); append a unique suffix to the caller's siteName so
	// a second call never collides with the first instead of failing loudly.
	const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
	const tempHost = `pending-${uniqueSuffix}`
	const uniqueSiteName = `${siteName} ${uniqueSuffix}`

	const siteRes = await fetch(`${TEST_SERVER_URL}/api/collections/sites/records`, {
		method: 'POST',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: uniqueSiteName, host: tempHost, group: groupId })
	})
	if (!siteRes.ok) throw new Error(`failed to create site record: ${siteRes.status} ${await siteRes.text()}`)
	const site = await siteRes.json()
	const siteId = site.id as string

	const patchRes = await fetch(`${TEST_SERVER_URL}/api/collections/sites/records/${siteId}`, {
		method: 'PATCH',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({ host: siteId })
	})
	if (!patchRes.ok) throw new Error(`failed to set unassigned host: ${patchRes.status} ${await patchRes.text()}`)

	// import.go syncs `sites.name` from site.yaml's `name:` back onto the
	// existing site record on every push (so devs can rename via YAML).
	// sites has a UNIQUE(name, group) index — pushing the fixture's
	// committed site.yaml verbatim ("Fixture Site") would rename every
	// seeded site to the same name and collide after the first.
	//
	// Every other _id in the fixture (page, section, block, fields) is
	// preserved verbatim on import too (import.go re-keys records to the
	// YAML's _id when present), and PocketBase ids are unique per
	// collection SERVER-WIDE, not scoped per site — pushing the same
	// committed _ids into a second site collides on "id: Value must be
	// unique." So: work from a temp copy, and rewrite every 15-char
	// lowercase-alphanumeric id string found anywhere in it (that's the
	// PocketBase id shape used throughout — see fields.yaml/config.yaml/
	// pages/index.yaml) to a fresh random one, consistently across files,
	// via a single find-and-replace map.
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'primo-e2e-fixture-'))
	fs.cpSync(FIXTURE_SITE_DIR, tmpDir, { recursive: true })

	const idPattern = /\b[a-z0-9]{15}\b/g
	const idMap = new Map<string, string>()
	const rewriteIdsInFile = (filePath: string) => {
		const original = fs.readFileSync(filePath, 'utf8')
		const rewritten = original.replace(idPattern, (match) => {
			if (!idMap.has(match)) idMap.set(match, randomSiteId())
			return idMap.get(match)!
		})
		if (rewritten !== original) fs.writeFileSync(filePath, rewritten)
	}
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name)
			if (entry.isDirectory()) walk(full)
			else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) rewriteIdsInFile(full)
		}
	}
	walk(tmpDir)

	// site.yaml's site_id must match the sites record we just created
	// (not a random replacement), and name must be this call's unique name.
	fs.writeFileSync(path.join(tmpDir, 'site.yaml'), `name: ${uniqueSiteName}\nsite_id: ${siteId}\n`)

	execFileSync('node', [CLI_ENTRY, 'push', '--server', TEST_SERVER_URL, '--site', siteId, '--dir', tmpDir, '-t', devToken], {
		stdio: 'inherit'
	})
	fs.rmSync(tmpDir, { recursive: true, force: true })

	const pagesRes = await fetch(
		`${TEST_SERVER_URL}/api/collections/pages/records?filter=${encodeURIComponent(`site = "${siteId}"`)}`,
		{ headers }
	)
	const pages = (await pagesRes.json()).items
	const homePage = pages.find((p: any) => p.name === 'Home')
	if (!homePage) throw new Error(`Fixture Home page not found after seeding site ${siteId}`)

	const sectionsRes = await fetch(
		`${TEST_SERVER_URL}/api/collections/page_sections/records?filter=${encodeURIComponent(`page = "${homePage.id}"`)}`,
		{ headers }
	)
	const sections = (await sectionsRes.json()).items
	if (sections.length !== 1) throw new Error(`Expected 1 page section for site ${siteId}, found ${sections.length}`)
	const section = sections[0]

	const fieldsRes = await fetch(
		`${TEST_SERVER_URL}/api/collections/site_symbol_fields/records?filter=${encodeURIComponent(`symbol = "${section.symbol}"`)}`,
		{ headers }
	)
	const fields = (await fieldsRes.json()).items
	const fieldIds = Object.fromEntries(fields.map((f: any) => [f.key, f.id]))

	return { siteId, pageId: homePage.id, sectionId: section.id, symbolId: section.symbol, fieldIds }
}
