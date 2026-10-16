<script lang="ts">
	import UI from '../ui'
	import type { Entity } from '$lib/Entity'
	import type { Field } from '$lib/common/models/Field'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'

	let {
		field,
		entry,
		onchange
	}: {
		entity: Entity
		field: Field
		entry?: Entry
		fields: Field[]
		entries: Entry[]
		onchange: FieldValueHandler
		level: number
	} = $props()
</script>

<div>
	<UI.Switch label={field.label} value={entry?.value ?? false} oninput={(value) => onchange({ [field.key]: { 0: { value } } })} />
</div>

<style lang="postcss">
	div {
		width: 100%;
	}
</style>
