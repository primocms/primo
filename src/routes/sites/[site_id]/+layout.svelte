<script>
	import Pala from '$lib/builder/Pala.svelte'
	import { check_session } from '$lib/pocketbase/user'
	import { refresh_author_mode } from '$lib/pocketbase/author_mode'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { Sites } from '$lib/pocketbase/collections'
	import { current_user, set_current_user } from '$lib/pocketbase/user'
	import { Loader } from 'lucide-svelte'

	onMount(async () => {
		if (!(await check_session())) {
			await goto('/admin/auth')
			return
		}
		refresh_author_mode()
	})

	let { children } = $props()

	const site_id = $derived(page.params.site_id)
	const site = $derived(site_id ? Sites.one(site_id) : null)

	$effect(() => set_current_user(site || undefined))
</script>

{#if site === null}
	<div class="placeholder">Site not found</div>
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
