<script>
	import { page } from '$app/stores'
	import { fade } from 'svelte/transition'
	import AuthForm from './AuthForm.svelte'
	import ServerLogo from '$lib/components/ui/ServerLogo.svelte'

	let { form } = $props()

	let email = $state($page.url.searchParams.get('email') || '')
	let password = $state('')

	let error = $derived(form?.error)

	let signing_in = $state(false)

	let stage = $state('signin')
	$effect.pre(() => {
		if ($page.url.searchParams.has('signup')) {
			stage = 'signup'
		} else if ($page.url.searchParams.has('reset')) {
			stage = 'confirm_reset'
		}
	})
</script>

{#key signing_in}
	<main in:fade class="primo-reset">
		<div class="left">
			<div class="logo">
				<div class="logo-container">
					<ServerLogo />
				</div>
			</div>
			<div class="box">
				{#if stage === 'signin'}
					{#snippet footer()}
						<button onclick={() => (stage = 'reset_password')}>Forgot your password?</button>
					{/snippet}
					<AuthForm action="sign_in" title="Sign In" bind:email bind:password {footer} {error} />
				{:else if stage === 'signup'}
					<AuthForm action="sign_up" title="Sign Up" bind:email bind:password {error} />
				{:else if stage === 'reset_password'}
					{#if form?.success}
						<span>A link to reset your password has been emailed to you.</span>
					{:else}
						<AuthForm action="reset_password" title="Reset Password" bind:email {error} />
					{/if}
				{:else if stage === 'confirm_reset'}
					<AuthForm action="confirm_password_reset" title="Reset Password" bind:email bind:password disable_email={true} {error} />
				{/if}
			</div>
		</div>
	</main>
{/key}

<style lang="postcss">
	main {
		display: grid;
		min-height: 100vh;
		background: var(--color-gray-9);
		color: white;
	}
	.logo {
		display: flex;
		justify-content: center;
		width: 100%;
		margin-bottom: 2rem;

		.logo-container {
			width: 8rem;
		}
	}
	.box {
		width: 100%;
		max-width: 450px;
		padding: 2.5rem;
		border-radius: 6px;
		background-color: #1a1a1a;
	}
	.left {
		padding: 3rem clamp(3rem, 10vw, 160px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
</style>
