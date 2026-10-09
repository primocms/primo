<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { Users } from '$lib/pocketbase/collections'
	import { self } from '$lib/pocketbase/managers'
	import { onDestroy } from 'svelte'
	import { Input } from '$lib/components/ui/input'
	import { Button } from '$lib/components/ui/button'
	import PasswordInput from '$lib/components/auth/PasswordInput.svelte'
	import { Loader, User } from 'lucide-svelte'

	type AuthAction = 'sign_in' | 'reset_password' | 'confirm_password_reset' | 'create_account'

	let { title, email = $bindable(''), password = $bindable(''), action, footer = null }: { action: AuthAction } & Record<string, any> = $props()

	let confirm_password = $state('')
	let passwordResetRequested = $state(false)
	let loading = $state(false)
	let error = $state('')
	let name = $state('')
	let avatar = $state('')
	let avatarFile = $state<File | null>(null)

	const newPassword = $derived(action === 'confirm_password_reset' || action === 'create_account')
	onDestroy(() => {
		if (avatar) URL.revokeObjectURL(avatar)
	})

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

		if (avatar) URL.revokeObjectURL(avatar)
		avatarFile = file
		avatar = URL.createObjectURL(file)
	}

	const submit = async (event: SubmitEvent) => {
		event.preventDefault()
		if (loading || passwordResetRequested) return
		error = ''
		if (newPassword && password !== confirm_password) {
			error = 'Passwords do not match. Please check both fields.'
			return
		}
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
{#if error}<div class="auth-alert auth-error" role="alert">{error}</div>{/if}
{#if passwordResetRequested}
	<div class="auth-alert" role="status">
		If an account exists for <strong>{email}</strong>
		{','} you’ll receive a password reset link. Check your spam folder too.
	</div>
{:else}
	<form class="auth-form" onsubmit={submit} aria-busy={loading}>
		<div class="auth-fields">
			{#if !newPassword}
				<div class="auth-label">
					<label for="auth-email">Email</label>
					<Input id="auth-email" data-test-id="email" bind:value={email} type="email" name="email" autocomplete="email" required disabled={loading} class="h-10" />
				</div>
			{/if}
			{#if action === 'create_account' && invitedEmail}
				<div class="auth-label">
					<label for="invited-email">Email</label>
					<Input id="invited-email" value={invitedEmail} type="email" data-test-id="email" disabled class="h-10" />
				</div>
				<div class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
					<div class="auth-label">
						<label for="auth-name">
							Name <span class="auth-note">(optional)</span>
						</label>
						<Input id="auth-name" data-test-id="name" bind:value={name} name="name" autocomplete="name" placeholder="Your name" disabled={loading} class="h-10" />
					</div>
					<label class="relative flex h-10 w-10 items-center justify-center rounded-md border border-input bg-muted text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
						{#if avatar}<img src={avatar} alt="Avatar preview" class="h-full w-full rounded-md object-cover" />{:else}<User size={18} aria-hidden="true" />{/if}
						<input type="file" accept="image/*" aria-label="Upload profile photo" onchange={handleAvatarChange} disabled={loading} class="absolute inset-0 h-full w-full opacity-0 cursor-pointer" />
					</label>
				</div>
			{/if}
			{#if action !== 'reset_password'}
				<PasswordInput
					id="auth-password"
					name="password"
					testId="password"
					bind:value={password}
					autocomplete={newPassword ? 'new-password' : 'current-password'}
					disabled={loading}
					minlength={newPassword ? 8 : undefined}
					describedby={newPassword ? 'password-help' : undefined}
				/>
			{/if}
			{#if newPassword}
				<p id="password-help" class="auth-note -mt-2">Use at least 8 characters.</p>
				<PasswordInput id="auth-confirm-password" name="confirm-password" label="Confirm password" testId="confirm-password" bind:value={confirm_password} disabled={loading} minlength={8} />
			{/if}
		</div>
		<Button class="w-full h-10" type="submit" data-test-id="submit" disabled={loading}>
			{#if loading}<Loader class="animate-spin" aria-hidden="true" />{/if}
			{loading ? 'Please wait…' : action === 'reset_password' ? 'Send reset link' : action === 'confirm_password_reset' ? 'Save new password' : title}
		</Button>
	</form>
{/if}
{#if footer}<div class="auth-footer">{@render footer()}</div>{/if}
