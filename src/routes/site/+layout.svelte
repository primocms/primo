<script>
	import Pala from '$lib/builder/Pala.svelte'
	import { check_session } from '$lib/pocketbase/user'
	import { refresh_author_mode } from '$lib/pocketbase/author_mode'
	import { self } from '$lib/pocketbase/managers'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { Sites } from '$lib/pocketbase/collections'
	import CreateSite from '$lib/components/CreateSite.svelte'
	import { current_user, set_current_user } from '$lib/pocketbase/user'
	import { Loader } from 'lucide-svelte'

	let { children } = $props()

	const host = $derived(page.url.host)
	const is_localhost = $derived(host === 'localhost:3000' || host === '127.0.0.1:3000' || host.startsWith('localhost:') || host.startsWith('127.0.0.1:') || host.includes('.localhost:'))

	// Track if we've done the initial check
	let initial_check_done = $state(false)
	let should_create_site = $state(false)

	onMount(async () => {
		if (!(await check_session())) {
			await goto('/admin/auth')
			return
		}

		// Refresh author_mode on every load — needed because reloads on
		// /admin/site skip the auth layout's dev-auth handshake.
		refresh_author_mode()

		// On localhost root, check if we need to redirect to first available site
		if (is_localhost) {
			try {
				// Direct API call to get all sites - this ensures we have real data
				const response = await self.instance?.collection('sites').getList(1, 1)
				if (response && response.items.length > 0) {
					const first_site = response.items[0]
					// Check if current host doesn't match any site
					const host_match = await self.instance?.collection('sites').getFirstListItem(`host = "${host}"`)
						.catch(() => null)

					if (!host_match && first_site.host) {
						// Redirect to first site
						window.location.href = `http://${first_site.host}/admin/site`
						return
					}
				} else {
					// No sites exist, show create screen
					should_create_site = true
				}
			} catch {
				// If API fails, fall through to normal flow
			}
		}

		initial_check_done = true
	})

	// First try to find site by exact host match
	const sites_by_host = $derived(Sites.list({ filter: { host } }))
	const site = $derived(sites_by_host?.[0])

	// For non-localhost, show create if no site matches after initial check
	let creating_site = $state(false)
	$effect(() => {
		if (initial_check_done && !creating_site && !site && !is_localhost && self.instance?.authStore.isValid) {
			creating_site = true
		}
		// For localhost, use the explicit flag from onMount
		if (should_create_site && !creating_site) {
			creating_site = true
		}
	})

	$effect(() => set_current_user(site || undefined))
</script>

{#if creating_site && $current_user}
	<CreateSite
		oncreated={(created) => {
			// Hard-navigate to the new site's admin. If the host differs (localhost
			// dashboard flow), this redirects to the right vhost. If it matches, a
			// reload sidesteps the stale Sites.list() cache that would otherwise
			// re-trigger the create-site gate.
			const target_host = created?.host || host
			const protocol = page.url.protocol || 'http:'
			window.location.href = `${protocol}//${target_host}/admin/site`
		}}
	/>
{:else if site && $current_user}
	<Pala {site}>
		{@render children?.()}
	</Pala>
{:else}
	<div class="placeholder">
		<Loader />
	</div>
{/if}

<style>
	.placeholder {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		color: white;
	}
</style>
