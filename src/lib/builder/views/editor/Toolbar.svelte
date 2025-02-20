<script>
	import { getContext, createEventDispatcher } from 'svelte'
	import { fade } from 'svelte/transition'
	import { find as _find } from 'lodash-es'
	import { browser } from '$app/environment'
	import Icon from '@iconify/svelte'
	import ToolbarButton from './ToolbarButton.svelte'
	import Letter from '$lib/builder/ui/Letter.svelte'
	import { PrimoButton } from '$lib/builder/components/buttons'
	import site from '$lib/builder/stores/data/site'
	import pages from '$lib/builder/stores/data/pages'
	import page_types from '$lib/builder/stores/data/page_types'
	import { mod_key_held } from '$lib/builder/stores/app/misc'
	import { userRole, hotkey_events } from '$lib/builder/stores/app'
	import active_page from '$lib/builder/stores/data/page'
	import modal from '$lib/builder/stores/app/modal'
	import { click_to_copy } from '$lib/builder/utilities'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { active_users } from '$lib/builder/stores/app/misc'
	import { timeline } from '$lib/builder/stores/data'
	import { undo_change, redo_change } from '$lib/builder/actions/misc'

	const dispatch = createEventDispatcher()

	let { primary_buttons, secondary_buttons, dropdown, children } = $props()

	// $: pageEmpty =
	// 	$sections && $sections.length <= 1 && $sections.length > 0 && $sections[0]['type'] === 'options'

	let DEBUGGING = $state()
	if (browser) DEBUGGING = getContext('DEBUGGING')

	let showing_dropdown = false

	let going_up = $state(false)
	hotkey_events.on('up', () => {
		going_up = true
		if (previous_page) {
			goto(`/${$site.id}/${previous_page.slug}`)
		}
		setTimeout(() => {
			going_up = false
		}, 600)
	})

	let going_down = $state(false)
	hotkey_events.on('down', () => {
		going_down = true
		if (next_page) {
			goto(`/${$site.id}/${next_page.slug}`)
		}
		setTimeout(() => {
			going_down = false
		}, 600)
	})

	let previous_page = $derived(
		$page.data.page ? $pages.find((p) => p.parent === $active_page.parent && p.index === $page.data.page.index - 1) : $page_types.find((p) => p.index === $page.data.page_type.index - 1)
	)
	let next_page = $derived(
		$page.data.page ? $pages.find((p) => p.parent === $active_page.parent && p.index === $page.data.page.index + 1) : $page_types.find((p) => p.index === $page.data.page_type.index + 1)
	)
</script>

<nav aria-label="toolbar" id="primo-toolbar" class="primo-reset">
	<div class="menu-container">
		<div class="left">
			<PrimoButton />
			<div class="button-group">
				{#if $mod_key_held}
					<div
						style="
						font-size: 0.75rem;
						padding-inline: 9px;
						display: flex;
						gap: 4px;
						justify-content: space-around;
					border: 1px solid var(--color-gray-8);
					color: white;
					height: 100%;
					align-items: center;
					border-radius: var(--primo-border-radius);"
					>
						<div style:color={going_up ? 'var(--weave-primary-color)' : 'inherit'} style:opacity={previous_page ? '1' : '0.1'}>&#8984; ↑</div>
						<div style:color={going_down ? 'var(--weave-primary-color)' : 'inherit'} style:opacity={next_page ? '1' : '0.1'}>&#8984; ↓</div>
					</div>
				{:else}
					<ToolbarButton label="Pages" icon="iconoir:multiple-pages" on:click={() => modal.show('SITE_PAGES', {}, { hideLocaleSelector: true, maxWidth: '1200px', showSwitch: false })} />
				{/if}
			</div>

			<div class="button-group">
				<ToolbarButton icon="gg:website" on:click={() => modal.show('SITE_EDITOR', {}, { showSwitch: true, disabledBgClose: true })} />
				{#each primary_buttons as button}
					<ToolbarButton icon={button.icon} on:click={button.onclick} />
				{/each}
			</div>

			<!-- <div class="button-group">
				{#each primary_buttons as button}
					<ToolbarButton icon={button.icon} on:click={button.onclick} />
				{/each}
			</div> -->

			<!-- TODO: Re-enable Visitor Forms -->
			<!-- <div
				class="dropdown"
				class:active={showing_dropdown}
				use:clickOutside
				on:click_outside={() => {
					showing_dropdown = false
				}}
			>
				<button class="down" on:click={() => (showing_dropdown = !showing_dropdown)}>
					<div class="icon">
						<Icon icon="charm:menu-kebab" />
					</div>
				</button>
				{#if showing_dropdown}
					<div class="list" in:fade={{ duration: 100 }}>
						{#each dropdown as button}
							<button
								on:click={() => {
									showing_dropdown = false
									button.onclick()
								}}
							>
								<Icon icon={button.icon} />
								<span>{button.label}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div> -->
		</div>
		<div class="site-name">
			<span class="site">{$site.name} /</span>
			{#if DEBUGGING}
				<span class="page">
					{$active_page.name}
					<button use:click_to_copy>({$active_page.id})</button>
				</span>
			{:else if $page.data.page}
				<span class="page">{$active_page.name}</span>
				{#if $userRole === 'DEV'}
					<a class="page-type-badge" style="background-color: {$active_page.page_type?.color};" href="/{$site.id}/page-type--{$active_page.page_type?.id}">
						<Icon icon={$active_page.page_type.icon} />
					</a>
				{:else}
					<span class="page-type-badge" style="background-color: {$active_page.page_type?.color};">
						<Icon icon={$active_page.page_type.icon} />
					</span>
				{/if}
			{:else if $page.data.page_type}
				<span class="page-type" style:background={$page.data.page_type.color}>
					<Icon icon={$page.data.page_type.icon} />
					<span>{$page.data.page_type.name}</span>
				</span>
			{:else}
				<span class="page">{$active_page.name}</span>
			{/if}
		</div>
		<div class="right">
			{#if $active_users.length > 0}
				<div class="active-editors" style="display: flex; gap: 0.25rem">
					{#each $active_users as user}
						<div class="editor" transition:fade={{ duration: 200 }}>
							<Letter letter={user.email.slice(0, 1)} />
						</div>
					{/each}
				</div>
			{/if}
			{#if !$timeline.first}
				<ToolbarButton id="undo" title="Undo" icon="material-symbols:undo" style="border: 0; font-size: 1.5rem;" on:click={undo_change} />
			{/if}
			{#if !$timeline.last}
				<ToolbarButton id="redo" title="Redo" icon="material-symbols:redo" style="border: 0; font-size: 1.5rem;" on:click={redo_change} />
			{/if}
			{#if $userRole === 'DEV'}
				<div class="button-group">
					{#each secondary_buttons as button}
						<ToolbarButton icon={button.icon} on:click={button.onclick} />
					{/each}
				</div>
			{/if}
			{@render children?.()}
			<!-- <LocaleSelector /> -->
			<ToolbarButton type="primo" icon="entypo:publish" label="Publish" active={false} on:click={() => dispatch('publish')} disabled={false} />
		</div>
	</div>
</nav>

<style lang="postcss">
	#primo-toolbar {
		z-index: 999;
		/* position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 999; */
		border-bottom: 1px solid var(--color-gray-8);
	}

	.left {
		/* width: 100%; */
		display: flex;
		justify-content: flex-start;
		gap: 0.25rem;
	}

	.dropdown {
		display: flex;
		position: relative;

		&.active {
			button.down {
				border-bottom-right-radius: 0;
				border-bottom-left-radius: 0;
			}
		}

		button.down {
			display: flex;
			color: white;
			border: 1px solid var(--color-gray-8);
			border-radius: 0.25rem;
			padding-inline: 12px;
			align-items: center;
			justify-content: center;
			transition: 0.1s;

			&:hover {
				background: var(--color-gray-8);
			}

			.icon {
				transition: 0.1s;
			}
		}

		.list {
			display: grid;
			position: absolute;
			background: rgb(17, 17, 17);
			top: 100%;
			border: 1px solid var(--color-gray-8);
			box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.2);

			button {
				padding: 0.25rem 0.75rem;
				color: white;
				display: flex;
				align-items: center;
				gap: 0.5rem;
				transition: 0.1s;

				span {
					white-space: nowrap;
				}

				&:hover {
					background: var(--color-gray-8);
				}
			}
		}
	}

	.left .button-group {
		display: flex;
		flex-direction: row;
	}

	.site-name {
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		place-content: center;

		.site {
			color: #b6b6b6;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.page {
			color: white;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.page-type {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			color: white;
			border-radius: 1rem;
			padding: 2px 6px;
			margin-left: 3px;
		}
		.page-type-badge {
			padding: 5px;
			border-radius: 1rem;
			aspect-ratio: 1;
			font-size: 0.75rem;
			display: flex;
			justify-content: center;
			align-items: center;
			color: white;
			margin-left: 3px;
		}

		@media (max-width: 670px) {
			display: none;
		}
	}

	.menu-container {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		margin: 0 auto;
		/* background: #121212; */
		/* background: var(--color-gray-9); */
		padding: 6px 0.5rem;
		/* position: fixed;
		left: 0;
		right: 0;
		top: 0;
		z-index: 9999; */
		backdrop-filter: blur(4px);
		background: rgba(10, 10, 10, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);

		@media (max-width: 670px) {
			grid-template-columns: 1fr 1fr;
		}
	}

	/* .menu-container:after {
		background: #121212;
		content: '';
		z-index: -1;
		height: 100%;
		width: 100%;
		position: absolute;
		top: 0;
		left: 0;
		backdrop-filter: blur(10px);
	} */

	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		place-content: flex-end;
	}

	.button-group {
		height: 100%;
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
	}
</style>
