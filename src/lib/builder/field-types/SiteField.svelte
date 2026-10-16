<script lang="ts">
	import type { FieldComponent } from '../components/Fields/field-component'
	import { fieldTypes } from '../stores/app'
	import { SiteFields, SiteEntries } from '$lib/pocketbase/collections'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Entity } from '$lib/Entity'
	import { setFieldEntries, type FieldValueHandler, type FieldValueMap } from '../components/Fields/FieldsContent.svelte'
	import type { Field } from '$lib/common/models/Field'
	import { site_context } from '$lib/builder/stores/context'

	const {
		entity,
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

	// Resolve the actual site field being referenced
	const resolvedField = $derived.by(() => {
		if (!field.config?.field) return null
		return SiteFields.one(field.config.field)
	})

	// Get the field type for the resolved field
	const fieldType = $derived.by(() => {
		if (!resolvedField) return null
		return $fieldTypes.find((ft) => ft.id === resolvedField.type)
	})

	const { value: site } = site_context.getOr({ value: null })
	const fields = $derived(site?.fields() ?? [])
	const entries = $derived(site?.entries() ?? [])

	// Handle changes to the site field by updating the entry
	function handleFieldChange(values: FieldValueMap) {
		setFieldEntries({ fields, entries, updateEntry: SiteEntries.update, createEntry: SiteEntries.create, values })
		onchange({})
	}

	function deleteEntryRelatedRecords(entry_id: string) {
		// Delete all sub-entries.
		for (const entry of entries) {
			if (entry.parent === entry_id) {
				deleteEntryRelatedRecords(entry.id)
				SiteEntries.delete(entry.id)
			}
		}
	}

	function handleDeleteEntry(entry_id: string) {
		deleteEntryRelatedRecords(entry_id)
		SiteEntries.delete(entry_id)
	}
</script>

{#if site && resolvedField && fieldType}
	{@const SvelteComponent = fieldType.component as FieldComponent}
	<SvelteComponent entity={site} field={{ ...resolvedField, label: field.label }} {entry} {fields} {entries} onchange={handleFieldChange} ondelete={handleDeleteEntry} {level} />
{:else if !field.config?.field}
	<span>Please configure this field to select a site field.</span>
{:else if !entry}
	<span>No value found for this site field.</span>
{:else}
	<span>This field has been deleted or disconnected.</span>
{/if}

<style lang="postcss">
</style>
