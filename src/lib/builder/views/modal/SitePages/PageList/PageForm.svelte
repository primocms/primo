<script>
	import { createEventDispatcher } from 'svelte'
	import { fade } from 'svelte/transition'
	import UI from '../../../../ui'
	import pages from '$lib/builder/stores/data/pages'
	import page_types from '../../../../stores/data/page_types'
	import Icon from '@iconify/svelte'
	import { validate_url } from '../../../../utilities'
	import { Page } from '../../../../factories.js'

	/**
	 * @typedef {Object} Props
	 * @property {number | null} [parent]
	 */

	/** @type {Props} */
	let { parent = null } = $props()

	const dispatch = createEventDispatcher()

	// set page type equal to first sibling (i.e. the last type used under this parent)
	const first_sibling = $pages.filter((p) => p.parent === parent)[0]
	const default_page_type_id = first_sibling?.page_type

	const new_page = $state({
		name: '',
		slug: '',
		page_type: default_page_type_id || $page_types[0].id
	})

	let page_creation_disabled = $derived(!new_page.name || !new_page.slug)

	let page_label_edited = $state(false)
	$effect(() => {
		new_page.slug = page_label_edited ? validate_url(new_page.slug) : validate_url(new_page.name)
	})

	let new_page_details = $derived(
		Page({
			name: new_page.name,
			slug: new_page.slug,
			parent,
			page_type: new_page.page_type
		})
	)
</script>

<form
	onsubmit={(e) => {
		e.preventDefault()
		dispatch('create', new_page_details)
	}}
	in:fade={{ duration: 100 }}
	class:has-page-types={$page_types.length > 1}
>
	<UI.TextInput autofocus={true} bind:value={new_page.name} id="page-label" label="Page Name" placeholder="About Us" />
	<UI.TextInput bind:value={new_page.slug} id="page-slug" label="Page Slug" oninput={() => (page_label_edited = true)} placeholder="about-us" />
	{#if $page_types.length > 1}
		<UI.Select
			fullwidth={true}
			label="Page Type"
			value={new_page.page_type}
			options={$page_types.sort((a, b) => a.index - b.index).map((p) => ({ value: p.id, icon: p.icon, label: p.name }))}
			on:input={({ detail }) => (new_page.page_type = detail)}
		/>
	{/if}
	<button disabled={page_creation_disabled}>
		<Icon icon="akar-icons:check" />
	</button>
</form>

<style lang="postcss">
	form {
		padding: 0.25rem;
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.5rem;
		padding: 0.825rem 1.125rem;
		align-items: flex-end;
		background: #1a1a1a;
		--TextInput-label-font-size: 0.75rem;

		&.has-page-types {
			grid-template-columns: 1fr 1fr 1fr auto;
		}

		button {
			border: 1px solid var(--weave-primary-color);
			border-radius: 0.25rem;
			padding: 9px 0.75rem;
			margin-top: 23px;

			&:disabled {
				opacity: 20%;
			}
		}
	}
</style>
