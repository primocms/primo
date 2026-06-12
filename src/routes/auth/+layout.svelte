<script>
	import { goto } from '$app/navigation'
	import { check_session } from '$lib/pocketbase/user'
	import { set_author_mode } from '$lib/pocketbase/author_mode'
	import { self } from '$lib/pocketbase/managers'
	import { onMount } from 'svelte'

	let loading = $state(true)

	const isLocalhost = () => {
		const host = window.location.hostname
		return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
	}

	const tryDevAuth = async () => {
		try {
			const response = await fetch('/api/primo/dev-auth', { method: 'POST' })
			if (response.ok) {
				const data = await response.json()
				if (data.token && data.record && self.instance) {
					self.instance.authStore.save(data.token, data.record)
					set_author_mode(data.author_mode)
					return true
				}
			}
		} catch {
			// Dev auth not available
		}
		return false
	}

	onMount(async () => {
		// Check existing session first
		if (await check_session()) {
			await goto('/admin/site')
			return
		}

		// Try auto-login on localhost
		if (isLocalhost() && await tryDevAuth()) {
			await goto('/admin/site')
			return
		}

		loading = false
	})

	let { children } = $props()
</script>

{#if loading}
	<div class="loading">Loading...</div>
{:else}
	{@render children?.()}
{/if}

<style>
	.loading {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		color: #888;
	}
</style>
