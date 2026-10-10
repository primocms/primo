<script lang="ts">
	import Card from '$lib/builder/ui/Card.svelte'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Field } from '$lib/common/models/Field'
	import { useContent, useEntries, type Entity } from '$lib/Content.svelte'
	import type { FieldValueHandler } from './FieldsContent.svelte'
	import { fieldTypes } from '../../stores/app/index.js'
	import type { Component } from 'svelte'
	import Icon from '@iconify/svelte'
	import { EyeOff } from 'lucide-svelte'
	import { current_user } from '$lib/pocketbase/user'
	import { locale } from '../../stores/app/misc'
	import { page_context, page_type_context } from '$lib/builder/stores/context'
	import { PageTypes, PageTypeFields } from '$lib/pocketbase/collections'

	let {
		entity,
		parent,
		field,
		fields,
		entries,
		level,
		onchange,
		ondelete,
		minimal
	}: {
		entity: Entity
		parent?: Entry
		field: Field
		fields: Field[]
		entries: Entry[]
		level: number
		onchange: FieldValueHandler
		ondelete: (entry_id: string) => void
		minimal?: boolean
	} = $props()

	const field_type = $derived($fieldTypes.find((ft) => ft.id === field.type))
	const Field_Component = $derived(
		field_type?.component as
			| Component<{
					entity: Entity
					field: Field
					entry?: Entry
					fields: Field[]
					entries: Entry[]
					onchange: FieldValueHandler
					ondelete: (entry_id: string) => void
					level: number
			  }>
			| undefined
	)

	const _data = $derived(useContent(entity, { target: 'cms' }))
	const data = $derived(_data && (_data[$locale] ?? {}))

	// Page Field relevance: hide Entry UI for content editors if the selected page field
	// does not belong to the active page type's field list.
	const { value: page_ctx } = page_context.getOr({ value: null })
	const { value: page_type_ctx } = page_type_context.getOr({ value: null })

	const active_page_type = $derived.by(() => {
		if (page_type_ctx) return page_type_ctx
		if (page_ctx) return PageTypes.one(page_ctx.page_type)
		return null
	})

	const selected_page_field = $derived.by(() => (field.type === 'page-field' && field.config?.field ? PageTypeFields.one(field.config.field) : null))
	const selected_page_type_page_type = $derived(selected_page_field ? PageTypes.one(selected_page_field.page_type) : null)
	const is_page_field_irrelevant = $derived.by(() => {
		if (field.type !== 'page-field') return false
		if (!selected_page_field) return false
		if (!active_page_type) return false
		return selected_page_field.page_type !== active_page_type.id
	})

	const is_visible = $derived.by(() => {
		// No condition set → visible
		if (!field.config?.condition) return true

		const { field: field_to_check, value: expected, comparison } = field.config.condition

		// Find the field this condition depends on (limited to same entity and, if applicable, same parent)
		const comparable_field = fields.find((f) => f.id === field_to_check)
		if (!comparable_field) return true // if missing, fail open

		// Prefer live entries (respecting parent nesting) so visibility reacts immediately to edits
		const [comparable_entry] = useEntries(entity, comparable_field, parent) ?? []
		const comparable_value = comparable_entry?.value ?? data?.[comparable_field.key]

		if (comparison === '=' && expected === comparable_value) return true
		if (comparison === '!=' && expected !== comparable_value) return true
		return false
	})
</script>

{#if !Field_Component}
	<!-- TODO: Improve the error message -->
	<span>Field type for the field is not found!</span>
{:else if field.type === 'page-field' && is_page_field_irrelevant}
	{#if $current_user?.siteRole === 'developer'}
		<div class="hidden-field">
			<EyeOff size="14" />
			<span>
				<strong>{field.label}</strong>
				isn't available on this page type and is hidden from content editors.
			</span>
		</div>
	{/if}
{:else if is_visible}
	{@const [entry] = useEntries(entity, field, parent) ?? []}
	{@const title = ['repeater', 'group'].includes(field.type) ? field.label : null}
	{@const icon = undefined}
	{#if field.type === 'site-field' || field.type === 'page-field'}
		<div class="dynamic-header">
			{#if field.type === 'site-field'}
				<Icon icon="gg:website" />
				<span>Site Field</span>
			{:else if field.type === 'page-field'}
				<Icon icon={selected_page_type_page_type?.icon || 'iconoir:page'} />
				<span>Page Field</span>
			{/if}
		</div>
	{/if}
	<Card {title} {icon} {minimal}>
		<Field_Component {entity} {field} {fields} {entries} {entry} {level} {onchange} {ondelete} {parent} />
	</Card>
{:else if $current_user?.siteRole === 'developer' && !is_visible}
	<div class="hidden-field">
		<EyeOff size="14" />
		<span>
			<strong>{field.label}</strong>
			 is hidden from content editors by its display condition.
		</span>
	</div>
{/if}

<style>
	.dynamic-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		border-bottom: 1px solid var(--color-gray-9);
		padding-block: 0.5rem;
		font-size: 0.75rem;
	}
	.hidden-field {
		padding: 1rem;
		color: var(--color-gray-2);
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
