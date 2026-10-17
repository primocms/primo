import type { Component } from 'svelte'
import type { Entity } from '$lib/Entity'
import type { Entry } from '$lib/common/models/Entry'
import type { Field } from '$lib/common/models/Field'
import type { FieldValueHandler } from './field-entries'

/** Shared rendering contract; the registry selects the component by field.type. */
export type FieldComponentProps = {
	entity: Entity
	field: Field
	entry?: Entry
	parent?: Entry
	fields: Field[]
	entries: Entry[]
	onchange: FieldValueHandler
	ondelete?: (entry_id: string) => void
	level: number
}
export type FieldComponent = Component<FieldComponentProps>
