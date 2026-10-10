<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { auth_url } from '$lib/auth_navigation'
	import { check_session } from '$lib/pocketbase/user'
	import { self } from '$lib/pocketbase/managers'

	let ready = $state(false)
	let approved = $state(false)
	let loading = $state(false)
	let error = $state('')
	const code = $derived(page.url.searchParams.get('code') || '')
	onMount(async () => {
		if (!(await check_session())) {
			await goto(auth_url(page.url), { replaceState: true })
			return
		}
		if (!/^[a-f0-9]{64}$/.test(code)) error = 'This authorization link is invalid. Ask your agent to start a new browser login.'
		ready = true
	})
	async function approve() {
		loading = true
		error = ''
		try {
			await self.instance.send('/api/primo/cli-login/approve', { method: 'POST', body: { code } })
			approved = true
		} catch (cause: any) {
			error = cause.message || 'Could not authorize. Ask your agent to start a new browser login.'
		} finally {
			loading = false
		}
	}
</script>

<svelte:head>
	<title>Authorize your agent · Primo</title>
	<meta name="referrer" content="no-referrer" />
</svelte:head>
<main class="primo-reset">
	<section>
		<h1>{approved ? 'Your agent is authorized' : 'Authorize your agent'}</h1>
		{#if approved}
			<p>Return to your agent. It can finish signing in and continue working on your website.</p>
		{:else if ready}
			<p>This gives the Primo CLI access to this instance with your account’s permissions, including saving and publishing sites you can edit.</p>
			<p>Approve only if you asked your agent to connect to this instance and it gave you this link.</p>
			{#if error}<p role="alert">{error}</p>{/if}
			<button onclick={approve} disabled={loading || !/^[a-f0-9]{64}$/.test(code)}>{loading ? 'Authorizing…' : 'Authorize CLI'}</button>
		{:else}<p>Checking your session…</p>{/if}
	</section>
</main>

<style>
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: #171717;
		color: #eee;
		padding: 2rem;
	}
	section {
		max-width: 480px;
		padding: 2rem;
		background: #222;
		border-radius: 6px;
	}
	h1 {
		font-size: 1.6rem;
		margin-bottom: 1rem;
	}
	p {
		line-height: 1.6;
		margin-bottom: 1rem;
		color: #bbb;
	}
	[role='alert'] {
		color: #f88;
	}
	button {
		border: 1px solid #ff6b35;
		border-radius: 4px;
		padding: 0.75rem 1rem;
		color: #eee;
	}
	button:disabled {
		opacity: 0.5;
	}
</style>
