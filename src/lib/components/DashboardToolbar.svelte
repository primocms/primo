<script>
	import UserPopup from './UserPopup.svelte'
	import { show } from '$lib/components/Modal.svelte'
	import { page } from '$app/stores'
	import ServerLogo from '$lib/ui/ServerLogo.svelte'
	import Icon from '@iconify/svelte'
</script>

<header role="navigation" aria-label="main navigation">
	<div class="logo">
		<ServerLogo />
	</div>
	<nav class="nav">
		{#if $page.data.user.admin}
			<button class="link" on:click={() => show('INVITE_COLLABORATORS')}>Members</button>
		{/if}
		{#if $page.data.user.role === 'DEV'}
			<a class="link with-icon" href="https://docs.primocms.org/" target="blank">
				<span class="docs">Docs</span>
				<Icon icon="gridicons:external" />
			</a>
		{/if}
		<UserPopup />
	</nav>
</header>

<style lang="postcss">
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--color-gray-3);
		margin-bottom: 1rem;
	}

	.nav {
		display: flex;
		gap: 1.25rem;
		align-items: center;
	}

	.logo {
		width: 7rem;
		object-fit: contain;
	}

	.link {
		border-bottom: 2px solid transparent;
		display: flex;
		font-size: 14px;

		&:hover {
			border-color: var(--primo-color-brand);
		}

		&.with-icon {
			display: grid;
			grid-template-columns: auto auto;
			gap: 0.5rem;
			place-items: center;
		}
	}

	nav {
		display: flex;
		align-items: center;
		gap: 1rem;

		.link {
			&:last-child {
				margin-right: 0;
			}
		}
	}
</style>
