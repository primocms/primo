import { track_cms_opened } from '$lib/analytics'
import { self } from './managers'
import type { Site } from '$lib/common/models/Site'
import { SiteRoleAssignments, Users } from './collections'
import { writable, readonly } from 'svelte/store'

let current_user_store = writable<
	| {
			id: string
			email: string
			serverRole: '' | 'editor' | 'developer' | undefined
			siteRole: 'editor' | 'developer' | null
			name: string | undefined
			avatar: string | undefined
	  }
	| null
	| undefined
>()

export const current_user = readonly(current_user_store)

export const set_current_user = (site?: Site) => {
	const user = self.instance?.authStore.record && Users.one(self.instance.authStore.record.id)
	const assignments = site && user && SiteRoleAssignments.list({ filter: { site: site.id, user: user.id } })
	const siteRole = user?.serverRole || assignments?.[0]?.role || null
	current_user_store.set(user && { id: user.id, email: user.email, serverRole: user.serverRole, siteRole, name: user.name, avatar: user.avatar })
}

export const check_session = async () => {
	const client = self.instance
	if (!client?.authStore.isValid) return false
	const original_token = client.authStore.token
	for (let attempt = 0; attempt < 2; attempt++) {
		// A different successful login/refresh owns its credentials now.
		if (attempt && client.authStore.token !== original_token) return false
		try {
			await client.collection('users').authRefresh()
			track_cms_opened()
			self.lists.clear()
			self.records.clear()
			return true
		} catch (error) {
			const failure = error as { isAbort?: boolean; status?: number } | undefined
			const temporary =
				failure?.isAbort ||
				failure?.status === 0 ||
				failure?.status === 408 ||
				failure?.status === 429 ||
				(failure?.status !== undefined && failure.status >= 500)
			if (client.authStore.token !== original_token) return false
			if (temporary && attempt === 0) {
				await new Promise((resolve) => setTimeout(resolve, 250))
				continue
			}
			// A transport/server outage does not establish that a token is bad.
			// Return unverified after a bounded retry; only rejection signs out.
			if (failure?.status === 400 || failure?.status === 401 || failure?.status === 403) client.authStore.clear()
			return false
		}
	}
	return false
}
