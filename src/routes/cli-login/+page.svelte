<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { auth_url } from '$lib/auth_navigation'
	import { check_session } from '$lib/pocketbase/user'
	import { self } from '$lib/pocketbase/instances'
	import AuthShell from '$lib/components/auth/AuthShell.svelte'
	import { Button } from '$lib/components/ui/button'
	import { Loader, Terminal, Check } from 'lucide-svelte'

	const code = $derived(page.url.searchParams.get('code') || '')
	const valid_code = $derived(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/.test(code))
	let loading = $state(true)
	let busy = $state(false)
	let error = $state('')
	let outcome = $state('')
	let email = $state('')

	onMount(async () => {
		if (!valid_code) {
			loading = false
			return
		}
		if (!(await check_session())) {
			await goto(auth_url(page.url), { replaceState: true })
			return
		}
		email = self.authStore.record?.email || ''
		loading = false
	})

	async function decide(action: 'approve' | 'deny') {
		if (busy) return
		busy = true
		error = ''
		try {
			await self.send('/api/primo/cli-login/approve', { method: 'POST', body: { user_code: code, action } })
			outcome = action
		} catch (err: any) {
			if (err.status === 401) {
				await goto(auth_url(page.url), { replaceState: true })
				return
			}
			error = err.response?.message || 'Could not complete this request. Start primo login again.'
		} finally {
			busy = false
		}
	}
</script>

<svelte:head>
	<title>Connect Primo CLI · Primo</title>
	<meta name="referrer" content="no-referrer" />
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>
<AuthShell>
	{#if loading}
		<div class="loading" role="status"><Loader size={18} class="animate-spin" aria-hidden="true" />Checking your session…</div>
	{:else if !valid_code}
		<header><h1>Login request unavailable</h1></header>
		<p class="description">Open the approval link provided by Primo to start a new request.</p>
	{:else if outcome}
		<header>
			<Check size={24} aria-hidden="true" class="mb-4" />
			<h1>{outcome === 'approve' ? 'Primo CLI connected' : 'Request declined'}</h1>
		</header>
		<p class="description">{outcome === 'approve' ? 'Your agent or terminal can continue. You can close this tab.' : 'Access was not granted. You can close this tab.'}</p>
	{:else}
		<header>
			<Terminal size={24} aria-hidden="true" class="mb-4" />
			<h1>Connect Primo CLI?</h1>
		</header>
		<p class="description">
			Allow Primo CLI to access <strong>{page.url.host}</strong>
			as
			<strong>{email}</strong>
			.
		</p>
		<p class="description">It will have your account’s existing permissions to read and edit sites, and publish where allowed.</p>
		<div class="request-code">
			<span>Check that this code matches the request from your agent or terminal:</span>
			<code>{code}</code>
		</div>
		<p class="auth-note">Only approve a request you started. This request expires after five minutes.</p>
		{#if error}<div class="auth-alert auth-error" role="alert">{error}</div>{/if}
		<div class="actions">
			<Button variant="outline" disabled={busy} onclick={() => decide('deny')}>Decline</Button>
			<Button disabled={busy} onclick={() => decide('approve')}>
				{#if busy}<Loader size={16} class="animate-spin" aria-hidden="true" />{/if}Allow access
			</Button>
		</div>
	{/if}
</AuthShell>

<style>
	.loading {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
	}
	.description {
		font-size: 14px;
		line-height: 1.6;
		margin: 0 0 16px;
		overflow-wrap: anywhere;
	}
	.request-code {
		display: grid;
		gap: 12px;
		margin: 24px 0 16px;
		padding: 16px;
		border: 1px solid hsl(var(--border));
		border-radius: 6px;
		font-size: 13px;
		line-height: 1.5;
	}
	code {
		font-size: 17px;
		font-weight: 600;
		text-align: center;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 24px;
	}
</style>
