<script lang="ts">
	import type { FieldComponent } from '../components/Fields/field-component'
	import { fieldTypes } from '../stores/app'
	import { PageTypeEntries, PageTypeFields, PageTypes } from '$lib/pocketbase/collections'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Entity } from '$lib/Entity'
	import { PageEntries } from '$lib/pocketbase/collections'
	import { setFieldEntries, type FieldValueHandler, type FieldValueMap } from '../components/Fields/FieldsContent.svelte'
	import type { Field } from '$lib/common/models/Field'
	import { page_context, page_type_context } from '$lib/builder/stores/context'

	const {
		field,
		entry,
		onchange,
		level
	}: {
		entity: Entity
		field: Field
		entry?: Entry
		fields: Field[]
		entries: Entry[]
		onchange: FieldValueHandler
		level: number
	} = $props()

	// Resolve the actual page field being referenced
	const resolvedField = $derived.by(() => {
		if (!field.config?.field) return null
		return PageTypeFields.one(field.config.field)
	})

	// Get the field type for the resolved field
	const fieldType = $derived.by(() => {
		if (!resolvedField) return null
		return $fieldTypes.find((ft) => ft.id === resolvedField.type)
	})

	const { value: page_type } = page_type_context.getOr({ value: null })
	const page_type_fields = $derived(page_type?.fields())
	const page_type_entries = $derived(page_type?.entries())

	const { value: page } = page_context.getOr({ value: null })
	const page_page_type = $derived(page && PageTypes.one(page.page_type))
	const page_fields = $derived(page_page_type?.fields())
	const page_entries = $derived(page?.entries())

	const entity = $derived(page ?? page_type)
	const fields = $derived(page_fields ?? page_type_fields ?? [])
	const entries = $derived(page_entries ?? page_type_entries ?? [])
	const EntriesCollection = $derived(page ? PageEntries : PageTypeEntries)

	// Handle changes to the page field by updating the entry
	function handleFieldChange(values: FieldValueMap) {
		setFieldEntries({
			fields,
			entries,
			updateEntry: EntriesCollection.update,
			createEntry: (data) => {
				if (page) {
					return PageEntries.create({
						...data,
						page: page.id
					})
				} else {
					return PageTypeEntries.create(data)
				}
			},
			values
		})
		onchange({})
	}

	function deleteEntryRelatedRecords(entry_id: string) {
		// Delete all sub-entries.
		for (const entry of entries) {
			if (entry.parent === entry_id) {
				deleteEntryRelatedRecords(entry.id)
				EntriesCollection.delete(entry.id)
			}
		}
	}

	function handleDeleteEntry(entry_id: string) {
		deleteEntryRelatedRecords(entry_id)
		EntriesCollection.delete(entry_id)
	}
</script>

{#if entity && resolvedField && fieldType}
	{@const SvelteComponent = fieldType.component as FieldComponent}
	<SvelteComponent {entity} field={{ ...resolvedField, label: field.label }} {entry} {fields} {entries} onchange={handleFieldChange} ondelete={handleDeleteEntry} {level} />
{:else if !field.config?.field}
	<span>Please configure this field to select a page field.</span>
{:else if !entry}
	<span>No value found for this page field.</span>
{:else}
	<span>This field has been deleted or disconnected.</span>
{/if}
