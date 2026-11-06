import type { ComponentProps } from 'svelte'
import type { z } from 'zod'
import { FieldBase } from '../../src/lib/common/models/FieldBase'
import { OrderedSvelteMap } from '../../src/lib/pocketbase/OrderedSvelteMap'
import TextInput from '../../src/lib/builder/ui/TextInput.svelte'
import Switch from '../../src/lib/builder/ui/Switch.svelte'
import type { FieldComponentProps } from '../../src/lib/builder/components/Fields/field-component'

// These assignments are checked by npm run check, not emitted into the app.
const input: z.input<typeof FieldBase> = { id: 'field', type: 'text', index: 0, config: null }
const field = FieldBase.parse(input)
const key: string = field.key
const label: string = field.label
const nativeMap: Map<string, number> = new OrderedSvelteMap<string, number>()
const pair: IteratorResult<[string, number], undefined> = nativeMap.entries().next()
const textProps: ComponentProps<typeof TextInput> = { value: '', oninput: (value) => value.toUpperCase(), onkeydown: (event) => event.preventDefault(), onblur: (event) => event.relatedTarget }
const switchProps: ComponentProps<typeof Switch> = { value: false, oninput: (value) => !value }
const entryProps: Pick<FieldComponentProps, 'field' | 'onchange'> = { field: { ...field, type: 'text' }, onchange: (values) => Object.keys(values) }
void [key, label, pair, textProps, switchProps, entryProps]

// Negative assertions ensure callback payloads cannot silently regress.
// @ts-expect-error Text inputs deliver strings, not numbers.
const badText: ComponentProps<typeof TextInput> = { value: '', oninput: (value: number) => value.toFixed() }
// @ts-expect-error Switches deliver booleans, not strings.
const badSwitch: ComponentProps<typeof Switch> = { value: false, oninput: (value: string) => value.toUpperCase() }
void [badText, badSwitch]
