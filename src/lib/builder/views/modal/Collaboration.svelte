<script lang="ts">
	import { SiteRoleAssignment } from '$lib/common/models/SiteRoleAssignment'
	import type { User } from '$lib/common/models/User'
	import * as AlertDialog from '$lib/components/ui/alert-dialog'
	import * as Avatar from '$lib/components/ui/avatar'
	import { Button } from '$lib/components/ui/button'
	import * as Dialog from '$lib/components/ui/dialog'
	import { instance } from '$lib/instance'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { Collaborators, SiteRoleAssignments, Users, type Sites } from '$lib/pocketbase/collections'
	import { self } from '$lib/pocketbase/managers'
	import Icon from '@iconify/svelte'
	import { Loader } from 'lucide-svelte'
	import { nanoid } from 'nanoid'

	let { site }: { site: ObjectOf<typeof Sites> } = $props()

	let sending = $state(false)
	let generating = $state(false)
	let error = $state('')
	let link = $state('')
	let link_shown = $state(false)
	let email = $state('')
	let role = $state<SiteRoleAssignment['role']>('developer')

	async function invite_collaborator() {
		try {
			const stillLoading = !users || !server_members || !site_collborators
			if (stillLoading) {
				error = 'Not ready'
				throw new Error('Still loading')
			}

			sending = true
			error = ''

			const hasSiteAccess = [...server_members, ...site_collborators.map(({ user }) => user)].some((user) => user?.email === email)
			if (hasSiteAccess) {
				error = 'Collaborator already exists'
				throw new Error('Collaborator already exists')
			}

			const password = nanoid(30)
			const user =
				users.find((user) => user.email === email) ??
				Users.create({
					email,
					password,
					passwordConfirm: password,
					invite: 'pending'
				})
			SiteRoleAssignments.create({
				site: site.id,
				user: user.id,
				role
			})

			await self.commit()
			email = ''
			role = 'developer'
		} catch (e) {
			if (!error) error = 'Unexpected error'
			throw e
		} finally {
			sending = false
		}
	}

	async function generate_link() {
		try {
			const stillLoading = !users || !server_members || !site_collborators
			if (stillLoading) {
				error = 'Not ready'
				throw new Error('Still loading')
			}

			generating = true
			error = ''
			link = ''
			link_shown = false

			const hasSiteAccess = [...server_members, ...site_collborators.map(({ user }) => user)].some((user) => user?.email === email)
			if (hasSiteAccess) {
				error = 'Collaborator already exists'
				throw new Error('Collaborator already exists')
			}

			const user = users.find((user) => user.email === email)
			if (user) {
				SiteRoleAssignments.create({
					site: site.id,
					user: user.id,
					role
				})

				await self.commit()
				email = ''
				role = 'developer'
				link = location.protocol + '//' + site.host + '/admin'
				link_shown = true
			} else {
				const password = nanoid(30)
				const user = Users.create({
					email,
					password,
					passwordConfirm: password
				})
				SiteRoleAssignments.create({
					site: site.id,
					user: user.id,
					role
				})

				await self.commit()
				email = ''
				role = 'developer'

				const response = await fetch(`${self.instance?.baseURL}/api/primo/password-link`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${self.instance?.authStore.token}`
					},
					body: JSON.stringify({
						site_id: site.id,
						user_id: user.id
					})
				}).then((response) => {
					if (!response.ok) {
						error = 'Error generating link'
						throw new Error('Non-ok response')
					}
					return response.json()
				})
				link = response.link
				link_shown = true
			}
		} catch (e) {
			if (!error) error = 'Unexpected error'
			throw e
		} finally {
			generating = false
		}
	}

	async function handle_role_assignment_delete() {
		if (!collaborator_to_remove) return
		removing_collaborator = true
		SiteRoleAssignments.delete(collaborator_to_remove.assignment.id)
		await self.commit()
		is_remove_collaborator_open = false
		removing_collaborator = false
		collaborator_to_remove = undefined
	}

	let users = $derived(Collaborators.list())
	let server_members = $derived(users?.filter(({ serverRole }) => !!serverRole))
	let site_collborators = $derived(
		site
			.role_assignments()
			?.map((assignment) => ({
				assignment,
				user: users?.find((user) => user.id === assignment.user)
			}))
			.filter(
				(
					collaborator
				): collaborator is {
					assignment: ObjectOf<typeof SiteRoleAssignments>
					user: ObjectOf<typeof Collaborators>
				} => !!collaborator.user
			)
	)
	let is_remove_collaborator_open = $state(false)

	// Per-site editor cap: 0/undefined means unlimited. Only "editor"-role
	// assignments count toward it (developers are not billed editor seats).
	// Enforced server-side in internal/limits.go; this disables the invite
	// affordance once this site is at its plan's per-site editor limit.
	let site_editor_count = $derived(site.role_assignments()?.filter((a) => a.role === 'editor').length ?? 0)
	let at_editor_cap = $derived(!!instance.editor_cap && site_editor_count >= instance.editor_cap)
	let removing_collaborator = $state(false)
	let collaborator_to_remove = $state<{ user: User; assignment: SiteRoleAssignment }>()

	const role_names = {
		developer: 'Developer',
		editor: 'Content Editor'
	}
</script>

<AlertDialog.Root
	bind:open={link_shown}
	onOpenChange={(open) => {
		if (!open) {
			link = ''
		}
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Link to share</AlertDialog.Title>
			<AlertDialog.Description>
				Share the following link to invited user:
				<pre class="link">{link}</pre>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Done</AlertDialog.Cancel>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
	bind:open={is_remove_collaborator_open}
	onOpenChange={(open) => {
		if (!open) {
			removing_collaborator = false
			collaborator_to_remove = undefined
		}
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you sure?</AlertDialog.Title>
			<AlertDialog.Description>
				You are about to remove collaborator <strong>{collaborator_to_remove?.user.email}</strong>
				from the site.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handle_role_assignment_delete} class="bg-red-600 hover:bg-red-700">
				{#if removing_collaborator}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Remove {collaborator_to_remove?.user.email}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Header title="Site Collaborators" icon="clarity:users-solid" />

<div class="Invitation">
	<main>
		<h2>Invite site collaborator</h2>
		<form
			onsubmit={(e) => {
				e.preventDefault()

				if (!(e.submitter instanceof HTMLButtonElement)) {
					return
				}

				const method = e.submitter.value
				if (method === 'email') {
					invite_collaborator()
				} else if (method === 'link') {
					generate_link()
				}
			}}
		>
			<label class="subheading" for="email">Enter collaborator email</label>
			<div>
				<div class="input-group">
					<input bind:value={email} type="email" placeholder="Email address" name="email" required />
					<select bind:value={role} required>
						<option value="developer">Developer</option>
						<option value="editor">Content Editor</option>
					</select>
				</div>
			</div>
			<div>
				{#if instance.smtp_enabled}
					<button type="submit" value="email" disabled={at_editor_cap} title={at_editor_cap ? 'Editor limit reached for your plan. Upgrade to add more editors.' : undefined}>
						{#if sending}
							<Icon icon="eos-icons:three-dots-loading" />
						{:else}
							Send invite
						{/if}
					</button>
					<span>or</span>
				{/if}
				<button type="submit" value="link" disabled={at_editor_cap} title={at_editor_cap ? 'Editor limit reached for your plan. Upgrade to add more editors.' : undefined}>
					{#if generating}
						<Icon icon="eos-icons:three-dots-loading" />
					{:else}
						Generate link
					{/if}
				</button>
				{#if error}
					<output class="error">
						{error}
					</output>
				{/if}
			</div>
		</form>
		<section>
			<h3 class="subheading">People with Access</h3>
			{#if !server_members || !site_collborators}
				<span>Loading...</span>
			{:else}
				<ul>
					{#each server_members ?? [] as { id, email, avatar, name, serverRole }}
						<li>
							<Avatar.Root class="ring-background transition-all ring-2 size-[27px]">
								{#if avatar}
									<Avatar.Image src={avatar && `${self.instance?.baseURL}/api/files/collaborators/${id}/${avatar}`} alt={name || email} class="object-cover object-center" />
								{/if}
								<Avatar.Fallback class="text-xs">{(name || email).slice(0, 2).toUpperCase()}</Avatar.Fallback>
							</Avatar.Root>
							<span class="email">
								{#if name}
									<span>{name}</span>
									<span>({email})</span>
								{:else}
									<span>{email}</span>
								{/if}
							</span>
							<span class="role">
								{role_names[serverRole ?? 'none']}
							</span>
							<span class="remove-action" title="User with a server role cannot be removed from the site">
								<Button type="button" variant="destructive" disabled>
									<Icon icon="ion:trash" />
								</Button>
							</span>
						</li>
					{/each}
					{#each site_collborators ?? [] as { user, assignment }}
						<li>
							<Avatar.Root class="ring-background transition-all ring-2 size-[27px]">
								<Avatar.Image src={user.avatar && `${self.instance?.baseURL}/api/files/collaborators/${user.id}/${user.avatar}`} alt={user.name || user.email} class="object-cover object-center" />
								<Avatar.Fallback class="text-xs">{(user.name || user.email).slice(0, 2).toUpperCase()}</Avatar.Fallback>
							</Avatar.Root>
							<span class="email">
								{#if user.name}
									<span>{user.name}</span>
									<span>({user.email})</span>
								{:else}
									<span>{user.email}</span>
								{/if}
							</span>
							<span class="role">
								{role_names[assignment.role]}
							</span>
							<span class="remove-action" title="Remove the site collaborator">
								<Button
									type="button"
									variant="destructive"
									onclick={() => {
										collaborator_to_remove = { user, assignment }
										is_remove_collaborator_open = true
									}}
								>
									<Icon icon="ion:trash" />
								</Button>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</main>
</div>

<style lang="postcss">
	.Invitation {
		padding: 1rem 1.5rem;
		color: var(--color-gray-1);
		background: #111;
		overflow: auto;
		width: 100%;
	}
	main {
		display: grid;
		gap: 1.5rem;
	}
	h2 {
		font-weight: 700;
		font-size: 1rem;
	}
	.subheading {
		font-weight: 700;
		font-size: 0.75rem;
	}
	.link {
		margin-top: 0.5rem;
		padding: 1rem;
		background-color: #1c1c1c;
		white-space: pre-wrap;
		word-break: break-all;
		user-select: all;
	}
	form {
		display: grid;
		gap: 0.5rem;

		div {
			display: flex;
			gap: 0.5rem;
			font-size: 0.75rem;
			align-items: center;

			.input-group {
				flex: 1;
				border-radius: 4px;
				border: 1px solid var(--color-gray-7);
				color: var(--color-gray-2);
				height: 2.5rem;
			}

			input {
				height: 100%;
				flex: 1;
				padding: 0.25rem 0.5rem;
				border-right: 1px solid var(--color-gray-8);
				background: transparent;

				&:focus-visible {
					outline: none;
				}
			}

			select {
				background: transparent;
				margin-right: 0.5rem;
				outline: 0 !important;
			}

			button {
				padding: 10px 12px;
				background: var(--color-gray-7);
				border-radius: 4px;
			}

			.error {
				color: #f72228;
			}
		}
	}
	ul {
		margin-top: 0.5rem;
		display: grid;
		gap: 0.75rem;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 400;
		font-size: 0.75rem;
		/* color: #3a3d45; */
		.letter {
			height: 26px;
			width: 26px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: #81a6fd;
			color: white;
			font-weight: 700;
			font-size: 0.875rem;
			line-height: 0;
			border-radius: 50%;
		}
		.email {
			flex: 1;
		}
		.status-pill {
			padding: 2px 8px;
			border-radius: 12px;
			font-size: 0.625rem;
			font-weight: 500;
			text-transform: uppercase;
			letter-spacing: 0.025em;

			&.pending {
				background: rgba(251, 191, 36, 0.2);
				color: #fbbf24;
			}

			&.sent {
				background: rgba(129, 140, 248, 0.2);
				color: #818cf8;
			}
		}
	}
</style>
