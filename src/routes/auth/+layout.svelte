<script>
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { auth_destination } from '$lib/auth_navigation'
	import { check_session } from '$lib/pocketbase/user'
	import { set_author_mode } from '$lib/pocketbase/author_mode'
	import { self } from '$lib/pocketbase/managers'
	import { onMount } from 'svelte'
	import { Loader } from 'lucide-svelte'

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
			await goto(auth_destination(page.url, self.instance?.authStore.record), { replaceState: true })
			return
		}

		// Try auto-login on localhost
		if (isLocalhost() && (await tryDevAuth())) {
			await goto(auth_destination(page.url, self.instance?.authStore.record), { replaceState: true })
			return
		}

		loading = false
	})

	let { children } = $props()
</script>

{#if loading}
	<div class="loading" role="status"><Loader size={18} class="animate-spin" aria-hidden="true" />Loading workspace…</div>
{:else}
	{@render children?.()}
{/if}

<style>
	.loading {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100dvh;
		gap: 8px;
		font-size: 13px;
		color: hsl(var(--muted-foreground));
	}
</style>
