<script>
	import ModalHeader from '../ModalHeader.svelte'
	import PageList from './PageList/PageList.svelte'
	import Page_Types_List from './Page_Types_List/Page_Types_List.svelte'
	import Icon from '@iconify/svelte'
	import { userRole } from '$lib/builder/stores/app/misc'
	import { page } from '$app/stores'

	let current_step = $state($page.params.page_type ? 'page_types' : 'pages')
</script>

<ModalHeader>
	{#snippet title()}
		{#if $userRole === 'DEV'}
			<div class="tabs">
				<button class="title" class:active={current_step === 'pages'} onclick={() => (current_step = 'pages')}>
					<Icon icon="iconoir:multiple-pages" />
					<span>Pages</span>
				</button>
				<button class="title" class:active={current_step === 'page_types'} onclick={() => (current_step = 'page_types')}>
					<Icon icon="carbon:template" />
					<span>Page Types</span>
				</button>
			</div>
		{:else}
			<div class="flex items-center gap-2">
				<Icon icon="iconoir:multiple-pages" />
				<span>Pages</span>
			</div>
		{/if}
	{/snippet}
</ModalHeader>

<main>
	{#if current_step === 'pages'}
		<PageList />
	{:else}
		<Page_Types_List />
	{/if}
</main>

<style lang="postcss">
	.tabs {
		display: flex;
		justify-content: center;
		color: white;
	}
	.title {
		font-size: 0.875rem;
		padding: 0.75rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border-bottom: 1px solid #222;
		transition: 0.1s;

		&.active {
			border-bottom-color: var(--weave-primary-color);
		}
	}
	main {
		padding: 1rem;
		padding-top: 0.5rem;
		background: var(--primo-color-black);
		overflow-y: scroll;
	}
</style>
