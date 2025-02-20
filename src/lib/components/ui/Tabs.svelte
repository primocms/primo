<script>
	import Icon from '@iconify/svelte'
	import { fade } from 'svelte/transition'
	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	let { tabs, active_tab_id = $bindable(tabs[0]?.id) } = $props()

	$effect(() => {
		dispatch('switch', active_tab_id)
	})
</script>

{#if tabs.length > 1}
	<div class="tabs" in:fade={{ duration: 200 }}>
		{#each tabs as tab, i}
			<button class:active={active_tab_id === tab.id} onclick={() => (active_tab_id = tab.id)} id={tab.id ? `tab-${tab.id}` : null}>
				{#if tab.icon}
					<Icon icon={tab.icon} />
				{/if}
				{typeof tab === 'string' ? tab : tab.label}
			</button>
		{/each}
	</div>
{/if}

<style lang="postcss">
	.tabs {
		display: flex;
		justify-content: center;
		color: white;
		font-size: 0.875rem;
		button {
			font-size: 0.875rem;
			padding: 0.75rem 1rem;
			display: flex;
			align-items: center;
			gap: 0.25rem;
			border-bottom: 1px solid var(--color-gray-8);
			transition: 0.1s;

			&.active {
				border-bottom-color: var(--weave-primary-color);
			}
		}
	}
</style>
