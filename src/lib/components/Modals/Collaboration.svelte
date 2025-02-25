<script>
	import axios from 'axios'
	import * as timeago from 'timeago.js'
	import Icon from '@iconify/svelte'
	import { page } from '$app/stores'
	import ModalHeader from '$lib/components/ModalHeader.svelte'

	// export let site

	const site = $page.data.site

	let loading = $state(false)
	let email = $state('')
	let role = $state('DEV')

	async function invite_editor() {
		loading = true
		const { data: success } = await axios.post('/api/collaboration/collaborators', {
			site,
			email,
			role,
			url: $page.url.origin
		})
		if (success) {
			get_collaborators()
			get_invitations()
		} else {
			alert('Could not send invitation. Please try again.')
		}
		email = ''
		loading = false
	}

	let editors = $state([])
	let owner = $derived(editors[0])
	get_collaborators()

	export async function get_collaborators() {
		const { data } = await axios.get(`/api/collaboration/collaborators?site_id=${site.id}`)
		if (data) {
			editors = data
		}
	}

	let invitations = $state([])
	get_invitations()

	async function get_invitations() {
		const { data } = await axios.get(`/api/collaboration/invitations?site_id=${site.id}`)
		if (data) {
			invitations = data
		}
	}

	let adding_collaborator = false
</script>

<ModalHeader
	title="Editors"
	icon="clarity:users-solid"
	warn={() => {
		// if (!isEqual(local_component, component)) {
		//   const proceed = window.confirm(
		//     'Undrafted changes will be lost. Continue?'
		//   )
		//   return proceed
		// } else return true
		return true
	}}
/>

<div class="Invitation">
	<main>
		<h2>Invite site collaborator</h2>
		<form
			onsubmit={(e) => {
				e.preventDefault()
				invite_editor()
			}}
		>
			<label class="subheading" for="email">Enter collaborator email</label>
			<div>
				<div class="input-group">
					<input bind:value={email} type="email" placeholder="Email address" name="email" />
					<select bind:value={role}>
						<option value="DEV">Developer</option>
						<option value="EDITOR">Content Editor</option>
					</select>
				</div>
				<button type="submit">
					{#if loading}
						<Icon icon="eos-icons:three-dots-loading" />
					{:else}
						Send invite
					{/if}
				</button>
			</div>
		</form>
		{#if invitations.length > 0}
			<section>
				<h3 class="subheading">Invitations</h3>
				<ul>
					{#each invitations as { email, created_at }}
						<li>
							<span class="letter">{email[0]}</span>
							<span class="email">{email}</span>
							<span>Sent {timeago.format(created_at)}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
		<section>
			<h3 class="subheading">People with Access</h3>
			<ul>
				{#if owner}
					<li>
						<span class="letter">{owner.email[0]}</span>
						<span class="email">{owner.email}</span>
						<span class="role">Owner</span>
					</li>
				{/if}
				{#each editors.slice(1) as { email }}
					<li>
						<span class="letter">{email[0]}</span>
						<span class="email">{email}</span>
						<span class="role">Editor</span>
					</li>
				{/each}
			</ul>
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
		margin-bottom: 0.5rem;
	}
	form {
		display: grid;
		/* gap: 0.25rem; */

		div {
			display: flex;
			gap: 0.5rem;
			font-size: 0.75rem;

			.input-group {
				flex: 1;
				border-radius: 4px;
				border: 1px solid var(--color-gray-7);
				color: var(--color-gray-2);
			}

			input {
				flex: 1;
				padding: 0.25rem 0.5rem;
				border-right: 1px solid var(--color-gray-8);
				background: transparent;
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
	}
</style>
