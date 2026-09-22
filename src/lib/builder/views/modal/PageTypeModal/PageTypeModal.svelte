<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import Item from './Item.svelte'
	import Icon from '@iconify/svelte'
	import PageForm from './PageTypeForm.svelte'
	import { PageTypes } from '$lib/pocketbase/collections'
	import { site_context } from '$lib/builder/stores/context'
	import { page as pageState } from '$app/state'
	import { self } from '$lib/pocketbase/managers'
	import { read_only } from '$lib/pocketbase/author_mode'

	// Get site from context (preferred) or fallback to hostname lookup
	const { value: site } = site_context.get()

	async function create_page_type(new_page_type) {
		// Guard the mutation itself, not just the trigger: a form already open
		// when the mode flips would otherwise still submit.
		if ($read_only || !site) return

		// Add the site ID to the page type
		const page_type_data = {
			...new_page_type,
			site: site.id
		}

		PageTypes.create(page_type_data)
		self.commit()
	}

	let creating_page_type = $state(false)
</script>

<Dialog.Header title="Page Types" icon="lucide:layout-template" class="page-types-header" />
<main class="grid gap-3 p-3">
	<ul class="grid gap-2">
		{#each site?.page_types() || [] as page_type}
			<li>
				<Item {page_type} active={pageState.params.page_type === page_type.id} />
			</li>
		{/each}
		{#if creating_page_type && !$read_only}
			<li style="background: #1a1a1a;">
				<PageForm
					on:create={({ detail: new_page_type }) => {
						creating_page_type = false
						create_page_type(new_page_type)
					}}
				/>
			</li>
		{/if}
	</ul>
	{#if !$read_only}
		<button class="pub-btn primary w-full" disabled={creating_page_type === true} onclick={() => (creating_page_type = true)}>
			<Icon icon="akar-icons:plus" class="h-3.5 w-3.5" />
			Create Page Type
		</button>
	{/if}
</main>

<style lang="postcss">
	/* Match the publish dialog's surface (Deploy.svelte). */
	.page-types-header :global(h2) { font-size: 18px; font-weight: 500; color: #f4f4f5; }
	.pub-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 8px 13px; background: #252528; border: 1px solid #3a3a40; border-radius: 5px; color: #dedee3; cursor: pointer; font-size: 12px; font-weight: 400; }
	.pub-btn:hover { background: #303034; }
	.pub-btn.primary { background: #ededf0; color: #202023; border-color: #ededf0; font-weight: 500; }
	.pub-btn.primary:hover { background: white; border-color: white; }
	.pub-btn:disabled { opacity: .55; cursor: not-allowed; }
	.pub-btn:focus-visible { outline: 2px solid #956e51; outline-offset: 3px; }
</style>
