<script>
	import { goto } from '$app/navigation'
	import Item from './Item.svelte'
	import Button from '$lib/builder/ui/Button.svelte'
	import page_types from '$lib/builder/stores/data/page_types'
	import actions from '$lib/builder/actions/page_types'
	import active_page from '$lib/builder/stores/data/page'
	import { id as site_id } from '$lib/builder/stores/data/site'
	import PageForm from './PageTypeForm.svelte'
	import modal from '$lib/builder/stores/app/modal'

	async function create_page_type(new_page) {
		const page_type_id = await actions.create(new_page)
		goto(`/${$site_id}/page-type--${page_type_id}`)
		modal.hide()
	}

	async function delete_page(page_id) {
		actions.delete(page_id)
	}

	let creating_page = $state(false)
</script>

{#if $page_types.length > 0}
	<ul class="page-list root">
		{#each $page_types.sort((a, b) => a.index - b.index) as page}
			<li>
				<Item
					{page}
					active={$active_page.id === page.id}
					on:edit={({ detail }) => {
						console.log({ detail })
						actions.update(page.id, detail)
					}}
					on:delete={({ detail: page }) => delete_page(page.id)}
				/>
			</li>
		{/each}
		{#if creating_page}
			<li style="background: #1a1a1a;">
				<PageForm
					on:create={({ detail: new_page }) => {
						creating_page = false
						create_page_type(new_page)
					}}
				/>
			</li>
		{/if}
	</ul>
{/if}
<Button variants="secondary fullwidth" disabled={creating_page === true} onclick={() => (creating_page = true)} label="New Page Type" icon="akar-icons:plus" />

<style lang="postcss">
	ul.page-list {
		display: grid;
		gap: 0.5rem;
		color: var(--primo-color-white);
		border-radius: var(--primo-border-radius);
		margin-bottom: 1rem;

		li {
			border-radius: 0.25rem;
		}
	}
</style>
