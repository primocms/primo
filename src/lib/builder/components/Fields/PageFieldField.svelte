<script>
	import UI from '../../ui/index.js'
	import page from '../../stores/data/page.js'
	import page_type from '../../stores/data/page_type.js'
	import fieldTypes from '../../stores/app/fieldTypes.js'

	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	let { field } = $props()

	// fetch fields for current page
	const field_list = [...$page_type.fields.filter((f) => !f.parent).sort((a, b) => a.index - b.index), ...$page?.page_type.fields.filter((f) => !f.parent).sort((a, b) => a.index - b.index)]

	let field_synced_with_other_page_type = false
</script>

<div class="PageFieldField">
	{#if field_synced_with_other_page_type}
		<div>
			<p>
				Synced with {'{page_type}'}. Is hidden. Will fall back to other field. Delete.
			</p>
		</div>
	{:else}
		<div class="container">
			<!-- Field select -->
			<UI.Select
				fullwidth={true}
				on:input={({ detail }) => {
					dispatch('input', detail)
				}}
				label="Page Content"
				value={field.source}
				options={field_list.map((f) => ({
					label: f.label,
					value: f.id,
					icon: $fieldTypes.find((ft) => ft.id === f.type).icon
				}))}
			/>
		</div>
	{/if}
</div>

<style>
	.container {
		display: grid;
	}
</style>
