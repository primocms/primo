<script lang="ts">
	import { goto } from '$app/navigation'
	import { Users } from '$lib/pocketbase/collections'
	import { Loader } from 'lucide-svelte'
	import { self } from '$lib/pocketbase/managers'

	let email = $state('')
	let password = $state('')
	let confirm_password = $state('')
	let loading = $state(false)
	let checking_setup = $state(true)
	let error = $state('')
	const is_form_valid = $derived(email.trim() !== '' && password.length >= 8 && confirm_password !== '' && password === confirm_password)

	const users = self.instance?.collection('users')
	const superusers = self.instance?.collection('_superusers')

	// Check if setup is already complete and redirect if so
	$effect(() => {
		checking_setup = true
		error = ''

		superusers
			.authWithPassword('__pbinstaller@example.com', 'public-secret')
			.catch((err) => {
				error = 'Authentication failed! Setup may have been completed already.'
				throw err
			})
			.then(() => {
				checking_setup = false
			})
			.catch((err) => {
				console.error('Setup failed:', err)
			})
	})

	const create_user = async (event: SubmitEvent) => {
		event.preventDefault()

		if (password !== confirm_password) {
			error = 'Passwords do not match'
			return
		}

		loading = true
		error = ''

		try {
			await users.create({
				email,
				password,
				passwordConfirm: password,
				serverRole: 'developer'
			})

			await superusers.create({
				email,
				password,
				passwordConfirm: password
			})

			// Authenticate the user immediately after creation
			try {
				await Users.authWithPassword(email, password)
				console.log('User authenticated successfully')
			} catch (authError) {
				console.warn('Could not authenticate user:', authError)
			}

			// Go straight to site
			goto('/admin/site', { replaceState: true })
		} catch (err: any) {
			console.error('User creation error:', err)

			// Extract specific field errors if available
			if (err.response?.data) {
				const fieldErrors = Object.entries(err.response.data)
					.map(([field, details]: [string, any]) => `${field}: ${details.message || details}`)
					.join(', ')
				error = fieldErrors || err.message || 'Failed to create user'
			} else {
				error = err.message || 'Failed to create user'
			}
		}
		loading = false
	}

</script>

<main class="primo-reset">
	<div class="left">
		<div class="box">
			<header>
				<h1>Welcome to Primo</h1>
				<p class="subtitle">Create your admin account to get started</p>
			</header>

			{#if checking_setup}
				{#if error}
					<div class="loading-container">
						<p class="error">{error}</p>
					</div>
				{:else}
					<div class="loading-container">
						<Loader class="animate-spin" />
						<p>Checking setup status...</p>
					</div>
				{/if}
			{:else}
				{#if error}
					<div class="error">{error}</div>
				{/if}

				<form class="form" onsubmit={create_user}>
					<div class="fields">
						<label>
							<span>Email</span>
							<input data-test-id="email" bind:value={email} type="email" name="email" required />
						</label>
						<label>
							<span>Password</span>
							<input data-test-id="password" bind:value={password} type="password" name="password" required minlength="8" />
						</label>
						<label>
							<span>Confirm Password</span>
							<input data-test-id="confirm-password" bind:value={confirm_password} type="password" name="confirm-password" required />
						</label>
					</div>
					<button class="button" type="submit" data-test-id="create-user" disabled={loading || !is_form_valid}>
						<span class:invisible={loading}>Create Account</span>
						{#if loading}
							<div class="animate-spin absolute">
								<Loader />
							</div>
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
</main>

<style lang="postcss">
	main {
		display: grid;
		min-height: 100vh;
		background: var(--color-gray-9);
		color: white;
	}
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		color: #b6b6b6;

		p {
			font-size: 14px;
			margin: 0;
		}
	}
	.box {
		width: 100%;
		max-width: 500px;
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
	header {
		margin-bottom: 2rem;

		h1 {
			text-align: center;
			font-weight: 500;
			font-size: 28px;
			line-height: 32px;
			margin-bottom: 0.5rem;
		}

		.subtitle {
			text-align: center;
			color: #b6b6b6;
			font-size: 14px;
		}
	}
	.steps-indicator {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;

		.step {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			flex: 1;
			font-size: 14px;
			color: #6e6e6e;

			span {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 24px;
				height: 24px;
				border-radius: 50%;
				background-color: #2a2a2a;
				font-size: 12px;
				font-weight: 500;
			}

			&.active {
				color: #ff6b35;

				span {
					background-color: #ff6b35;
					color: white;
				}
			}

			&.completed {
				color: #4ade80;

				span {
					background-color: #4ade80;
					color: white;
				}
			}
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

			&:focus {
				outline: none;
				border-color: #ff6b35;
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
			border: 1.5px solid #ff6b35;
			border-radius: 0.25rem;
			position: relative;
			transition: 0.2s;

			&:not(:disabled):hover {
				background-color: #ff6b35;
				color: #121212;
			}

			&:disabled {
				opacity: 0.75;
				cursor: not-allowed;
				color: #6e6e6e !important;
				border-color: #444 !important;
				background-color: #2a2a2a !important;
				pointer-events: none;
			}

			.invisible {
				visibility: hidden;
			}

			@keyframes spin {
				from {
					transform: rotate(0deg);
				}
				to {
					transform: rotate(360deg);
				}
			}
		}
	}
	.step-content {
		text-align: center;

		h2 {
			font-size: 24px;
			font-weight: 500;
			margin-bottom: 1rem;
		}

		p {
			color: #b6b6b6;
			margin-bottom: 1rem;
			line-height: 1.5;
		}

		.instructions {
			font-size: 14px;
			color: #797979;
			margin-top: 1.5rem;
		}

		.credentials-box {
			background-color: #2a2a2a;
			border: 1px solid #444;
			border-radius: 8px;
			padding: 1rem;
			margin: 1.5rem 0;
			font-family: 'Fira Code', monospace;
			position: relative;

			.credential-item {
				margin-bottom: 0.5rem;
				font-size: 14px;

				strong {
					color: #ff6b35;
					margin-right: 0.5rem;
				}
			}

			.warning {
				margin-top: 1rem;
				padding: 0.5rem;
				background-color: #4a3728;
				border: 1px solid #8b6914;
				border-radius: 4px;
				color: #fbbf24;
				font-size: 12px;
				text-align: center;
			}

			.info {
				margin-top: 1rem;
				padding: 0.5rem;
				background-color: #1e3a4a;
				border: 1px solid #3b82f6;
				border-radius: 4px;
				color: #60a5fa;
				font-size: 12px;
				text-align: center;
			}
		}

		.database-link {
			font-size: 0.75rem;
			display: inline-block;
			margin-top: 1rem;
			color: #ff6b35;
			text-decoration: underline;

			&:hover {
				color: #5a6b7f;
			}
		}

		.button {
			color: #cecece;
			font-weight: 500;
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			padding: 0.65rem 2rem;
			border: 1.5px solid #ff6b35;
			border-radius: 0.25rem;
			margin: 0 auto;
			min-width: 200px;

			&:hover {
				background-color: #ff6b35;
				transition: 0.2s;
				color: #121212;
			}

			&.full-width {
				width: 100%;
				margin: 0;
			}
		}
	}
</style>
