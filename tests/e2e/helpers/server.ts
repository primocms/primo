import type { APIRequestContext } from '@playwright/test'
import { TEST_SERVER_URL } from './paths'

export const SERVER_URL = TEST_SERVER_URL

export interface DevAuthResult {
	token: string
	record: { id: string; email: string; serverRole: string }
}

/** Localhost-only dev auth (server started with PRIMO_DEV_MODE=1). Returns a
 * full-access "developer" account token — see internal/localhost.go. */
export async function devAuth(request: APIRequestContext): Promise<DevAuthResult> {
	const res = await request.post(`${SERVER_URL}/api/primo/dev-auth`)
	if (!res.ok()) throw new Error(`dev-auth failed: ${res.status()} ${await res.text()}`)
	return res.json()
}

function authHeaders(token: string) {
	return { Authorization: `Bearer ${token}` }
}

/** Creates (or reuses) a non-admin "editor" user and grants them an editor
 * role on the given site via site_role_assignments, using the developer
 * token for authority. Returns credentials for a fresh login. */
export async function ensureEditorUser(
	request: APIRequestContext,
	developerToken: string,
	siteId: string,
	email = 'editor@primo.local',
	password = 'editorpassword123'
): Promise<{ email: string; password: string; userId: string }> {
	// Look up existing user by name, not email: PocketBase treats `email` on
	// auth collections as filter-protected (masked from `filter=` matching
	// for non-owners regardless of emailVisibility, even though it's
	// present in list/view output) — filtering by email here silently
	// returns zero rows. `name` isn't subject to that and is unique enough
	// for this fixed test account.
	const listRes = await request.get(`${SERVER_URL}/api/collections/users/records`, {
		headers: authHeaders(developerToken),
		params: { filter: `name = "Editor User"` }
	})
	const list = await listRes.json()
	let userId: string
	if (list.items?.length > 0) {
		userId = list.items[0].id
	} else {
		const createRes = await request.post(`${SERVER_URL}/api/collections/users/records`, {
			headers: authHeaders(developerToken),
			data: {
				email,
				password,
				passwordConfirm: password,
				name: 'Editor User',
				emailVisibility: true
			}
		})
		if (!createRes.ok()) throw new Error(`create editor user failed: ${createRes.status()} ${await createRes.text()}`)
		const created = await createRes.json()
		userId = created.id
	}

	// Ensure a site_role_assignments row with role "editor" exists for (user, site)
	const assignmentsRes = await request.get(`${SERVER_URL}/api/collections/site_role_assignments/records`, {
		headers: authHeaders(developerToken),
		params: { filter: `site = "${siteId}" && user = "${userId}"` }
	})
	const assignments = await assignmentsRes.json()
	if (!assignments.items || assignments.items.length === 0) {
		const assignRes = await request.post(`${SERVER_URL}/api/collections/site_role_assignments/records`, {
			headers: authHeaders(developerToken),
			data: { site: siteId, user: userId, role: 'editor' }
		})
		if (!assignRes.ok()) throw new Error(`create site_role_assignment failed: ${assignRes.status()} ${await assignRes.text()}`)
	}

	return { email, password, userId }
}

export async function apiLoginAs(request: APIRequestContext, email: string, password: string): Promise<string> {
	const res = await request.post(`${SERVER_URL}/api/collections/users/auth-with-password`, {
		data: { identity: email, password }
	})
	if (!res.ok()) throw new Error(`login failed for ${email}: ${res.status()} ${await res.text()}`)
	const body = await res.json()
	return body.token
}
