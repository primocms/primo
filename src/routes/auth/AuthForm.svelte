<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { Users } from '$lib/pocketbase/collections'
	import { self } from '$lib/pocketbase/managers'
	import { Loader, User } from 'lucide-svelte'

	type AuthAction = 'sign_in' | 'reset_password' | 'confirm_password_reset' | 'create_account'

	let { title, email = $bindable(), password = $bindable(null), action, footer = null }: { action: AuthAction } & Record<string, any> = $props()

	let confirm_password = $state('')
	let passwordResetRequested = $state(false)
	let loading = $state(false)
	let error = $state('')
	let name = $state('')
	let avatar = $state('')
	let avatarFile = $state<File | null>(null)

	const createToken = $derived(page.url.searchParams.get('create') || '')
	const invitedEmail = $derived(page.url.searchParams.get('email') || '')

	const handleAvatarChange = async (event: Event) => {
		const target = event.target as HTMLInputElement
		const input_file = target.files?.[0]
		if (!input_file) return

		error = ''
		let file = input_file

		// iPhones save photos as HEIC by default; PocketBase rejects them. Convert to JPEG.
		const is_heic = /\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)
		if (is_heic) {
			try {
				loading = true
				const { default: heic2any } = await import('heic2any')
				const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
				const blob = Array.isArray(converted) ? converted[0] : converted
				file = new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' })
			} catch (err) {
				error = 'Could not read this photo. Try a JPEG or PNG instead.'
				return
			} finally {
				loading = false
			}
		}

		avatarFile = file
		avatar = URL.createObjectURL(file)
	}

	const submit = async (event: SubmitEvent) => {
		event.preventDefault()
		switch (action) {
			case 'sign_in':
				loading = true
				await Users.authWithPassword(email, password)
					.then(() => goto('/admin/site'))
					.catch(({ message }) => {
						error = message
					})
				loading = false
				break
			case 'reset_password':
				loading = true
				await Users.requestPasswordReset(email)
					.then(() => {
						passwordResetRequested = true
					})
					.catch(({ message }) => {
						error = message
					})
				loading = false
				break
			case 'confirm_password_reset':
				loading = true
				const token = page.url.searchParams.get('reset') || ''
				await Users.confirmPasswordReset(token, password, confirm_password)
					.then(() => goto('/admin/auth'))
					.catch((err) => {
						// Extract the actual error message from PocketBase
						if (err.response?.data?.password) {
							error = err.response.data.password.message
						} else if (err.response?.message) {
							error = err.response.message
						} else {
							error = err.message || 'An error occurred'
						}
					})
				loading = false
				break
			case 'create_account':
				loading = true
				await Users.confirmPasswordReset(createToken, password, confirm_password)
					.then(async () => {
						if (invitedEmail) {
							// Auto-login invited users
							await Users.authWithPassword(invitedEmail, password)

							// Update user with name and avatar if provided
							const userId = self.instance?.authStore.record?.id
							if ((name || avatarFile) && userId) {
								const data: any = {}
								if (name) data.name = name
								if (avatarFile) data.avatar = avatarFile
								await self.instance?.collection('users').update(userId, data)
							}
							await goto('/admin/site')
						} else {
							await goto('/admin/auth')
						}
					})
					.catch((err) => {
						// Extract the actual error message from PocketBase
						if (err.response?.data?.password) {
							error = err.response.data.password.message
						} else if (err.response?.message) {
							error = err.response.message
						} else {
							error = err.message || 'An error occurred'
						}
					})
				loading = false
				break
			default:
				throw new Error('Unknown action')
		}
	}
</script>

<header>
	<h1>{title}</h1>
</header>
{#if error}
	<div class="error">{error}</div>
{/if}
{#if passwordResetRequested}
	<div class="message">Password reset has been sent to your email. Remember to also check the spam folder.</div>
{/if}
<form class="form" onsubmit={submit}>
	<div class="fields">
		{#if action !== 'confirm_password_reset' && action !== 'create_account'}
			<label>
				<span>Email</span>
				<input data-test-id="email" bind:value={email} type="text" name="email" disabled={passwordResetRequested} />
			</label>
		{/if}
		{#if action === 'create_account' && invitedEmail}
			<label>
				<span>Email</span>
				<input data-test-id="email" bind:value={email} type="text" name="email" disabled />
			</label>
			<div class="grid grid-cols-[1fr_auto] gap-2 items-end">
				<label class="grid gap-2">
					<span>Name & Avatar</span>
					<input data-test-id="name" bind:value={name} type="text" name="name" placeholder="John Doe" />
				</label>
				<div class="relative">
					{#if avatar}
						<img src={avatar} alt="Avatar preview" class="h-[50px] w-[50px] rounded-lg object-cover border border-gray-600 bg-gray-800" />
					{:else}
						<div class="h-[50px] w-[50px] rounded-lg border border-gray-600 bg-gray-800 flex items-center justify-center text-gray-600">
							<User size={20} />
						</div>
					{/if}
					<input type="file" accept="image/*" onchange={handleAvatarChange} class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
				</div>
			</div>
		{/if}
		{#if action !== 'reset_password'}
			<label>
				<span>Password</span>
				<input data-test-id="password" bind:value={password} type="password" name="password" />
			</label>
		{/if}
		{#if action === 'confirm_password_reset' || action === 'create_account'}
			<label>
				<span>Confirm Password</span>
				<input data-test-id="confirm-password" bind:value={confirm_password} type="password" name="confirm-password" />
			</label>
		{/if}
	</div>
	<button class="button" type="submit" data-test-id="submit" disabled={passwordResetRequested}>
		<span class:invisible={loading}>{title}</span>
		{#if loading}
			<div class="animate-spin absolute">
				<Loader />
			</div>
		{/if}
	</button>
</form>
{#if footer}
	<span class="footer-text">{@render footer()}</span>
{/if}

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
	.message {
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
		}

		::file-selector-button {
			display: none;
		}

		.button {
			color: #cecece;
			font-weight: 500;
			display: flex;
			flex-direction: row;
			justify-content: center;
			align-items: center;
			padding: 0.65rem;
			border: 1.5px solid var(--primo-primary-color);
			border-radius: 0.25rem;

			&:hover {
				background-color: var(--primo-primary-color);
				transition: 0.2s;
				color: white;
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
	}
</style>
