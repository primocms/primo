<script lang="ts">
	import type { PageField } from '$lib/common/models/fields/PageField'
	import UI from '../ui/index.js'
	import type { Entity } from '$lib/Entity'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'
	import { site_context } from '$lib/builder/stores/context'

	const { field, entry, onchange }: { entity: Entity; field: PageField; entry?: Entry; onchange: FieldValueHandler } = $props()
	const { value: site } = site_context.getOr({ value: null })
	const selectable_pages = $derived.by(() => {
		const pages = site?.pages() ?? []
		const filtered = pages.filter((p) => p.page_type === field.config?.page_type)
		return filtered
	})
</script>

<div>
	<UI.Select
		label={field.label}
		value={entry?.value || ''}
		options={selectable_pages.map((page) => ({
			value: page.id,
			label: page?.name
		}))}
		on:input={({ detail }) => {
			onchange({ [field.key]: { 0: { value: detail } } })
		}}
		fullwidth={true}
	/>
</div>

<style lang="postcss">
	div {
		width: 100%;
	}
</style>
