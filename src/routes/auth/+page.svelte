<script>
	import { page, navigating } from '$app/stores'
	import { fade } from 'svelte/transition'
	import { enhance } from '$app/forms'
	import ServerLogo from '$lib/ui/ServerLogo.svelte'
	import Icon from '@iconify/svelte'

	export let form

	let email = $page.url.searchParams.get('email') || ''
	let password = ''
	let password_confirm = ''

	$: error = form?.error

	$: signing_in = $page.url.searchParams.has('signup') ? false : true
	$: signup_disabled = !password || password !== password_confirm
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
				<header>
					<!-- <img src={logo_dark} alt="breely logo" /> -->
					<h1>{signing_in ? 'Sign in' : 'Create your account'}</h1>
					{#if !signing_in}
						<p>
							Welcome to your new Primo server! Enter an email address and password you'll use to
							administrate this server.
						</p>
					{/if}
				</header>
				{#if error}
					<div class="error">{error}</div>
				{/if}
				<form
					class="form"
					method="POST"
					action="?/{signing_in ? 'sign_in' : 'sign_up'}"
					use:enhance
				>
					<div class="fields">
						<label>
							<span>Email</span>
							<input bind:value={email} type="text" name="email" />
						</label>
						<label>
							<span>Password</span>
							<input bind:value={password} type="password" name="password" />
						</label>
						{#if !signing_in}
							<label>
								<span>Confirm password</span>
								<input bind:value={password_confirm} type="password" name="password" />
							</label>
						{/if}
					</div>
					<button class="button" type="submit" disabled={signing_in ? false : signup_disabled}>
						{#if !$navigating}
							{#if signing_in}
								<span>Sign in</span>
							{:else}
								<span>Sign up</span>
							{/if}
						{:else}
							<div class="icon"><Icon icon="gg:spinner" /></div>
						{/if}
					</button>
				</form>
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
			width: 10rem;
		}
	}
	header {
		/* img {
      padding-bottom: 40px;
    } */
		h1 {
			text-align: left;
			font-weight: 500;
			font-size: 24px;
			line-height: 24px;
			padding-bottom: 1rem;
			/* --typography-spacing-vertical: 1rem; */
		}
		p {
			color: var(--color-gray-3);
			padding-bottom: 1.5rem;
		}
	}
	.error {
		color: #f72228;
		margin-bottom: 1rem;
	}
	.left {
		padding: 3rem clamp(3rem, 10vw, 160px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.box {
		width: 100%;
		max-width: 450px;
		padding: 2.5rem;
		border-radius: 6px;
		background-color: #1a1a1a;
	}
	.form {
		display: grid;
		gap: 2rem;
		width: 100%;

		.fields {
			display: grid;
			gap: 1rem;
		}

		label {
			color: #b6b6b6;
			display: grid;
			gap: 0.5rem;
			font-size: 0.875rem;
			font-weight: 400;
		}

		input {
			color: #dadada;
			border-radius: 0.25rem;
			border: 1px solid #6e6e6e;
			padding: 0.75rem;
			background-color: #1c1c1c;
			font-size: 1rem;
		}

		.button {
			color: #cecece;
			font-weight: 500;
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			padding: 0.65rem;
			border: 1.5px solid #35d994;
			border-radius: 0.25rem;
			transition: 0.1s;

			&:not([disabled]):hover {
				background-color: #35d994;
				transition: 0.2s;
				color: #121212;
			}

			&:focus {
				background-color: #208259;
			}

			.icon {
				animation: icon-spin 1s linear infinite;
			}

			&[disabled] {
				opacity: 0.5;
				cursor: not-allowed;
			}

			@keyframes icon-spin {
				0% {
					transform: rotate(0deg);
				}
				100% {
					transform: rotate(360deg);
				}
			}
		}
	}
</style>
