<script>
	import { get_page_fields } from '$lib/builder/stores/helpers.js'
	import fieldTypes from '$lib/builder/stores/app/fieldTypes.js'

	let { id, value, fields, field, entries, oninput = /** @type {(val: {id: string, data: any, entries: any[]}) => void} */ () => {} } = $props()

	const source_field = get_page_fields().find((f) => f.id === field.source)

	function get_component(field) {
		const fieldType = $fieldTypes.find((ft) => ft.id === source_field.type)
		if (fieldType) {
			return fieldType.component
		} else {
			console.warn(`Field type '${field.type}' no longer exists, removing '${field.label}' field`)
			return null
		}
	}

	let all_fields = $derived([...fields, ...get_page_fields()])

	$inspect({ value })
</script>

{#if source_field}
	{@const SvelteComponent = get_component(field)}
	<SvelteComponent
		{id}
		{entries}
		{value}
		field={{ ...source_field, label: field.label }}
		fields={all_fields}
		on:keydown
		on:add
		on:remove
		on:move
		oninput={(detail) => {
			const source_entry_id = detail.id || id
			const data = detail.data || detail
			const updated_entries = entries.map((entry) => (entry.id === source_entry_id ? { ...entry, ...data } : entry))
			oninput({
				id: source_entry_id,
				data,
				entries: updated_entries
			})
		}}
	/>
{:else}
	<span>This field has been deleted or disconnected.</span>
{/if}

<style>
</style>
