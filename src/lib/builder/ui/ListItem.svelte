<!-- @migration-task Error while migrating Svelte code: This migration would change the name of a slot making the component unusable -->
<script>
	import Icon from '@iconify/svelte'
	import { slide } from 'svelte/transition'
	import { get, set } from 'idb-keyval'
	import { validate_url } from '../utilities'
	import MenuPopup from '../ui/Dropdown.svelte'

	export let title
	export let is_child = false
	export let subtitle = ''
	export let active = false
	export let children = []
	export let popup_menu = []
	export let icon_buttons = []

	let showing_children = false
	$: has_children = children.length > 0

	let toggled = true
	get(`form-list-toggle--${title}`).then((toggled) => {
		if (toggled !== undefined) showing_children = toggled
	})
	$: set(`form-list-toggle--${title}`, showing_children)

	let new_page_url = ''
	$: new_page_url = validate_url(new_page_url)
</script>

<div class="page-item-container" class:active class:expanded={showing_children && has_children} class:is_child>
	<div class="left">
		<div class="details">
			<p class:active class="name">{title}</p>
			{#if subtitle}
				<p class="url">{subtitle}</p>
			{/if}
			<slot name="title" />
		</div>
		{#if has_children}
			<button class="toggle" class:active={showing_children} on:click={() => (showing_children = !showing_children)} aria-label="Toggle child pages">
				<Icon icon="mdi:chevron-down" />
			</button>
		{/if}
	</div>
	{#if popup_menu.length > 0}
		<div class="options">
			<MenuPopup icon="carbon:overflow-menu-vertical" options={popup_menu} />
		</div>
	{/if}
	{#if icon_buttons?.length > 0}
		<div class="options">
			{#each icon_buttons as button}
				<button>
					<Icon icon={button.icon} />
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if showing_children && has_children}
	<ul class="page-list" transition:slide={{ duration: 100 }}>
		{#each children as subpage}
			<li>
				<svelte:self
					popup_menu={subpage.popup_menu || []}
					icon_buttons={subpage.icon_buttons || []}
					is_child={true}
					title={subpage.title}
					subtitle={subpage.subtitle}
					children={subpage.children || []}
					on:delete
					on:create
				/>
			</li>
		{/each}
	</ul>
{/if}

<style lang="postcss">
	.page-item-container {
		display: flex;
		justify-content: space-between;
		padding: 0.875rem 1.125rem;
		border-bottom-left-radius: 0.25rem;
		background: #1a1a1a;
		border-radius: var(--primo-border-radius);
		padding-block: 0.5rem;
		border-radius: 0;

		&.expanded {
			border-bottom-right-radius: 0;
			border-bottom: 1px solid var(--color-gray-9);
		}

		&.active {
			background: #222;
			border-bottom-right-radius: 0;
			/* outline: 1px solid var(--weave-primary-color); */
		}

		.left {
			display: flex;
			align-items: center;
			gap: 0.5rem;

			.details {
				font-weight: 400;
				line-height: 1.5rem;
				display: flex;
				gap: 1rem;
				color: var(--color-gray-1);

				.url {
					display: flex;
					font-weight: 400;
					color: var(--color-gray-5);
				}
			}

			.toggle {
				padding: 0 0.5rem;
				transition: 0.1s color;
				font-size: 1.5rem;

				&:hover {
					color: var(--weave-primary-color);
				}
			}
		}

		.options {
			display: flex;
			gap: 0.75rem;
		}
	}

	ul.page-list {
		margin-left: 1rem;
		/* background: #323334; */
		border-radius: var(--primo-border-radius);

		li:not(:last-child) {
			/* border-bottom: 1px solid #222; */
		}
	}
</style>
