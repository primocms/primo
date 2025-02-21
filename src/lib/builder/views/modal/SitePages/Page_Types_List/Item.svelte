<script>
	import Icon from '@iconify/svelte'
	import { createEventDispatcher, getContext } from 'svelte'
	const dispatch = createEventDispatcher()
	import { id as siteID } from '$lib/builder/stores/data/site'
	import { validate_url } from '$lib/builder/utilities'
	import PageForm from './PageTypeForm.svelte'
	import MenuPopup from '$lib/builder/ui/Dropdown.svelte'
	import modal from '$lib/builder/stores/app/modal'

	/**
	 * @typedef {Object} Props
	 * @property {boolean} active
	 * @property {import('$lib').Page_Type} page
	 */

	/** @type {Props} */
	let { active, page } = $props()

	let editing_page = $state(false)

	let creating_page = $state(false)
	let new_page_url = $state('')
	$effect(() => {
		new_page_url = validate_url(new_page_url)
	})

	const full_url = `/${$siteID}/page-type--${page.id}`
</script>

{#if editing_page}
	<PageForm
		{page}
		new_page_name={page.name}
		new_color={page.color}
		new_icon={page.icon}
		on:create={({ detail: modified_page }) => {
			editing_page = false
			console.log('first')
			dispatch('edit', modified_page.details)
		}}
	/>
{:else}
	<div class="Item">
		<span class="icon" style:background={page.color}>
			<Icon icon={page.icon} />
		</span>
		<div class="page-item-container" class:active>
			<div class="left">
				<a class="name" href={full_url} onclick={() => modal.hide()}>
					{page.name}
				</a>
			</div>
			<div class="options">
				<MenuPopup
					icon="carbon:overflow-menu-vertical"
					options={[
						{
							label: 'Change name/icon/color',
							icon: 'clarity:edit-solid',
							on_click: () => {
								editing_page = !editing_page
							}
						},
						...(page.name !== 'Default'
							? [
									{
										label: 'Delete Type & Instances',
										icon: 'fluent:delete-20-filled',
										on_click: () => {
											const confirm = window.confirm(`This will delete ALL pages of this page type. Continue?`)
											if (confirm) {
												dispatch('delete', page)
											}
										}
									}
								]
							: [])
					]}
				/>
			</div>
		</div>
	</div>
{/if}

{#if creating_page}
	<div style="border-left: 0.5rem solid #111;">
		<PageForm
			{page}
			on:create={({ detail: page }) => {
				creating_page = false
				dispatch('create', page)
			}}
		/>
	</div>
{/if}

<style lang="postcss">
	.Item {
		display: grid;
		grid-template-columns: auto 1fr;
		border-radius: var(--primo-border-radius);
		overflow: hidden;
	}
	.icon {
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		padding-inline: 1rem;
	}
	.page-item-container {
		flex: 1;
		display: flex;
		justify-content: space-between;
		padding: 0.875rem 1.125rem;
		background: #1a1a1a;
		/* border-top-left-radius: 0;
		border-bottom-left-radius: 0; */

		&.active a {
			color: var(--weave-primary-color);
			/* outline: 1px solid var(--weave-primary-color); */
		}

		.options {
			display: flex;
			gap: 0.75rem;
		}
	}

	.left {
		display: flex;
		align-items: center;
		gap: 0.75rem;

		a.name {
			border-bottom: 1px solid transparent;
			margin-bottom: -1px;
			transition: 0.1s;
			&:hover {
				border-color: white;
			}
		}

		.name {
			font-weight: 400;
			line-height: 1.5rem;
			display: flex;
			gap: 1rem;
			color: var(--color-gray-1);
		}
	}
</style>
