<script>
	import ModalHeader from '../ModalHeader.svelte'
	import PageList from './PageList/PageList.svelte'
	import Page_Types_List from './Page_Types_List/Page_Types_List.svelte'
	import Icon from '@iconify/svelte'
	import { get, set } from 'idb-keyval'
	import { userRole } from '$lib/builder/stores/app/misc'

	let current_step = $state(localStorage.getItem('current_step') || 'pages')
	function set_current_step(step) {
		set('SitePages-tab', step)
		current_step = step
	}

	get('SitePages-tab').then((res) => {
		if (res) current_step = res
	})
</script>

<ModalHeader>
	{#snippet title()}
		{#if $userRole === 'DEV'}
			<div class="tabs">
				<button class="title" class:active={current_step === 'pages'} onclick={() => set_current_step('pages')}>
					<Icon icon="iconoir:multiple-pages" />
					<span>Pages</span>
				</button>
				<button class="title" class:active={current_step === 'page types'} onclick={() => set_current_step('page types')}>
					<Icon icon="carbon:template" />
					<span>Page Types</span>
				</button>
			</div>
		{:else}
			<Icon icon="iconoir:multiple-pages" />
			<span class="title">Pages</span>
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
		gap: 0.25rem;
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
