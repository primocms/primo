<script>
	import { enhance } from '$app/forms'
	import Icon from '@iconify/svelte'

	let { title, email = $bindable(), password = $bindable(null), action, footer = null, error, disable_email = false } = $props()

	let loading = $state(false)

	function handle_submit() {
		loading = true
		return async ({ result, update }) => {
			loading = false
			if (result.type === 'success') {
				await update()
			}
		}
	}
</script>

<header>
	<h1>{title}</h1>
</header>
{#if error}
	<div class="error">{error}</div>
{/if}
<form class="form" method="POST" action="?/{action}" use:enhance={handle_submit}>
	<div class="fields">
		<label>
			<span>Email</span>
			<input data-test-id="email" bind:value={email} type="text" name="email" disabled={disable_email} />
		</label>
		{#if password !== null}
			<label>
				<span>Password</span>
				<input data-test-id="password" bind:value={password} type="password" name="password" />
			</label>
		{/if}
		<!-- <input name="invitation_id" type="text" class="hidden" value={$page.url.searchParams.get('join')} /> -->
	</div>
	<button class="button" type="submit" data-test-id="submit">
		{#if loading}
			<div class="icon"><Icon icon="gg:spinner" /></div>
		{:else}
			<span>{title}</span>
		{/if}
	</button>
</form>
{#if footer}
	<span class="footer-text">{@render footer()}</span>
{/if}

<!-- <span class="footer-text"
	>Don't have an account? <button on:click={() => dispatch('switch')}>Sign Up</button></span
> -->

<style lang="postcss">
	header {
		h1 {
			text-align: left;
			font-weight: 500;
			font-size: 24px;
			line-height: 24px;
			padding-bottom: 1rem;
		}
	}
	.error {
		color: #f72228;
		margin-bottom: 1rem;
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

			&.hidden {
				display: none;
			}
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

			&:hover {
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
	.footer-text {
		display: flex;
		gap: 0.25rem;
		font-size: 0.875rem;
		line-height: 1.125rem;
		color: #797979;
		text-align: left;
		margin-top: 1rem;

		button {
			color: #b6b6b6;
			text-decoration: underline;
		}
	}
</style>
