<script>
	import { page } from '$app/state'
	import AuthShell from '$lib/components/auth/AuthShell.svelte'
	import AuthForm from './AuthForm.svelte'
	let email = $state(page.url.searchParams.get('email') || '')
	let resetting = $state(false)
	const stage = $derived(page.url.searchParams.has('create') ? 'create_account' : page.url.searchParams.has('reset') ? 'confirm_password_reset' : resetting ? 'reset_password' : 'sign_in')
	const title = $derived({ sign_in: 'Sign in', reset_password: 'Reset password', confirm_password_reset: 'Reset password', create_account: 'Create account' }[stage])
</script>

<svelte:head><title>{title} · Primo</title></svelte:head>
<AuthShell>
	{#key stage}
		{#snippet footer()}
			{#if stage === 'sign_in'}<button type="button" onclick={() => (resetting = true)}>Forgot your password?</button>
			{:else if stage === 'reset_password'}<button type="button" onclick={() => (resetting = false)}>Back to sign in</button>{/if}
		{/snippet}
		<AuthForm action={stage} {title} bind:email {footer} />
	{/key}
</AuthShell>
