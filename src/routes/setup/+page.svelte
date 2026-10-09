<script lang="ts">
	import { goto } from '$app/navigation'
	import { Users } from '$lib/pocketbase/collections'
	import AuthShell from '$lib/components/auth/AuthShell.svelte'
	import PasswordInput from '$lib/components/auth/PasswordInput.svelte'
	import { Input } from '$lib/components/ui/input'
	import { Button } from '$lib/components/ui/button'
	import { Loader } from 'lucide-svelte'
	import { self } from '$lib/pocketbase/managers'
	import { instance } from '$lib/instance'

	// A fresh `primo deploy` seeds sites + library before any account exists,
	// so on first visit we can tell the operator what's already loaded. Falls
	// back gracefully to 0 when the fields are absent (older server).
	const seeded_sites = instance.site_count ?? 0
	const seeded_blocks = instance.library_block_count ?? 0
	const has_seeded_content = seeded_sites > 0 || seeded_blocks > 0

	const count_label = (n: number, singular: string) => `${n} ${singular}${n === 1 ? '' : 's'}`

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

<svelte:head><title>Set up your workspace · Primo</title></svelte:head>
<AuthShell>
	<header>
		<h1>Welcome to Primo</h1>
	</header>
	{#if error}<div class="auth-alert auth-error" role="alert">{error}</div>{/if}
	{#if checking_setup}
		{#if !error}<div class="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader class="size-4 animate-spin" aria-hidden="true" />Checking setup status…</div>{/if}
	{:else}
		{#if has_seeded_content}
			<div class="auth-alert" data-test-id="seeded-content">
				<p class="font-medium mb-1">Already loaded on this server</p>
				<ul>
					{#if seeded_sites > 0}<li>{count_label(seeded_sites, 'site')}</li>{/if}{#if seeded_blocks > 0}<li>{count_label(seeded_blocks, 'library block')}</li>{/if}
				</ul>
			</div>
		{/if}
		<form class="auth-form" onsubmit={create_user} aria-busy={loading}>
			<div class="auth-fields">
				<div class="auth-label">
					<label for="setup-email">Email</label>
					<Input id="setup-email" data-test-id="email" bind:value={email} type="email" name="email" autocomplete="email" required disabled={loading} class="h-10" />
				</div>
				<PasswordInput id="setup-password" name="password" testId="password" bind:value={password} minlength={8} disabled={loading} describedby="setup-password-help" />
				<p id="setup-password-help" class="auth-note -mt-2">Use at least 8 characters.</p>
				<PasswordInput id="setup-confirm-password" name="confirm-password" label="Confirm password" testId="confirm-password" bind:value={confirm_password} minlength={8} disabled={loading} />
			</div>
			<Button class="w-full h-10" type="submit" data-test-id="create-user" disabled={loading || !is_form_valid}>
				{#if loading}<Loader class="animate-spin" aria-hidden="true" />{/if}{loading ? 'Creating account…' : 'Create account'}
			</Button>
			{#if instance.telemetry_enabled}<p class="auth-note" data-test-id="telemetry-note">
					This server sends anonymous usage analytics (no page content or emails) to help improve Primo.
					{#if !instance.hosted_mode}
						Disable with <code>PRIMO_ENABLE_USAGE_STATS=false</code>
						.
					{/if}
					<a href="https://github.com/primocms/primo/blob/main/ANALYTICS.md" target="_blank" rel="noopener noreferrer">What's collected</a>
				</p>{/if}
		</form>
	{/if}
</AuthShell>
