<script>
	import Item from './Item.svelte'
	import Button from '$lib/builder/ui/Button.svelte'
	import pages from '$lib/builder/stores/data/pages'
	import actions from '$lib/builder/actions/pages'
	import active_page from '$lib/builder/stores/data/page'
	import { flip } from 'svelte/animate'
	import PageForm from './PageForm.svelte'

	async function create_page(new_page, index) {
		const url_taken = $pages.some((page) => page.slug === new_page.slug)
		if (url_taken) {
			alert(`That URL is already in use`)
		} else {
			await actions.create({ ...new_page, index })
		}
	}

	async function delete_page(page) {
		actions.delete(page)
	}

	let creating_page = $state(false)
</script>

<ul class="page-list root">
	{#each $pages.filter((p) => !p.parent).sort((a, b) => a.index - b.index) as page (page.id)}
		{@const children = $pages.filter((p) => p.id !== page.id && p.parent === page.id)}
		<li animate:flip={{ duration: 200 }}>
			<Item
				{page}
				{children}
				active={$active_page.id === page.id}
				on:create={({ detail }) => create_page(detail.page, detail.index)}
				on:delete={({ detail: terminal_page }) => delete_page(terminal_page)}
			/>
		</li>
	{/each}
	{#if creating_page}
		<li style="background: #1a1a1a;">
			<PageForm
				on:create={({ detail: new_page }) => {
					creating_page = false
					create_page(new_page, $pages.length)
				}}
			/>
		</li>
	{/if}
</ul>
<Button variants="secondary fullwidth" disabled={creating_page === true} onclick={() => (creating_page = true)} label="Create Page" icon="akar-icons:plus" />

<style lang="postcss">
	ul.page-list {
		display: grid;
		/* gap: 0.5rem; */
		color: var(--primo-color-white);

		margin-bottom: 0.5rem;

		li {
			/* overflow: hidden; */
		}

		/* &.root > li:not(:first-child) {
			border-top: 1px solid #222;
		} */
	}
</style>
