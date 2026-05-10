<script lang="ts">
	import FieldItem from './FieldItem.svelte'
	import { tick } from 'svelte'
	import { cloneDeep } from 'lodash-es'
	import autosize from 'autosize'
	import { mod_key_held } from '../../stores/app/misc'
	import UI from '../../ui/index.js'
	import Icon from '@iconify/svelte'
	import Condition from './Condition.svelte'
	import PageField from './PageField.svelte'
	import SiteFieldField from './SiteFieldField.svelte'
	import PageFieldField from './PageFieldField.svelte'
	import PageListField from './PageListField.svelte'
	import SelectField from './SelectField.svelte'
	import ImageFieldOptions from './ImageFieldOptions.svelte'
	import fieldTypes from '../../stores/app/fieldTypes.js'
	import { dynamic_field_types } from '$lib/builder/field-types'
	import { site_context, hide_dynamic_field_types_context, hide_page_field_field_type_context, hide_site_field_field_type_context } from '$lib/builder/stores/context'
	import type { Field } from '$lib/common/models/Field'
	import pluralize from 'pluralize'

	let {
		field,
		fields,
		level = 0,
		top_level = true,
		create_field,
		onchange,
		onduplicate,
		ondelete,
		onmove
	}: {
		field: Field
		fields: Field[]
		level?: number
		top_level?: boolean
		create_field?: (data?: Partial<Field>) => void
		onchange: (details: { id: string; data: Partial<Field> }) => void
		onduplicate: (id: string) => void
		ondelete: (field: Field) => void
		onmove: (id: string, direction: 'up' | 'down') => void
	} = $props()

	const { value: site } = site_context.getOr({ value: null })
	const page_types = $derived(site?.page_types() ?? [])

	// Workaround for derived being lazy:
	// Ensure page types list begins loading as soon as the editor renders,
	// so switching to Page/Page List has data available.
	$effect(() => {
		// Accessing the link in an effect triggers the CollectionMapping list loader.
		// We intentionally ignore the return; we just want to kick off loading.
		site?.page_types()
	})

	let visible_field_types = $derived.by(() => {
		let list = $fieldTypes
		if (hide_dynamic_field_types_context.getOr(false)) {
			list = list.filter((ft) => !dynamic_field_types.includes(ft.id))
		}
		if (hide_page_field_field_type_context.getOr(false)) {
			list = list.filter((ft) => ft.id !== 'page-field')
		}
		if (hide_site_field_field_type_context.getOr(false)) {
			list = list.filter((ft) => ft.id !== 'site-field')
		}
		return list
	})

	let comparable_fields = $derived(
		fields
			.filter((f) => {
				const is_valid_type = ['text', 'number', 'switch', 'url', 'select'].includes(f.type)
				const same_parent = (!f.parent && !field.parent) || f.parent === field.parent
				const is_previous_sibling = same_parent && (f.index || 0) < (field.index || 0)
				return is_valid_type && is_previous_sibling
			})
			.sort((a, b) => (a.index || 0) - (b.index || 0))
	)

	function validate_field_key(key) {
		// replace dash and space with underscore
		return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
	}

	function make_unique_label(base_label) {
		if (!base_label) return base_label
		const base = String(base_label).trim()
		const siblings = fields.filter((f) => f.id !== field.id && ((!f.parent && !field.parent) || f.parent === field.parent)).map((f) => (f.label || '').trim().toLowerCase())
		let candidate = base
		let i = 2
		while (siblings.includes(candidate.trim().toLowerCase())) {
			candidate = `${base} ${i}`
			i++
		}
		return candidate
	}

	// Auto-fill key when setting label (only for new fields without a key yet)
	let key_edited = $state(field.key !== '')

	// autosize info textarea
	let info_textarea
	$effect(() => {
		if (info_textarea) {
			autosize(info_textarea)
		}
	})

	let width = $state<number>()
	let collapsed = $state(false)
	$effect(() => {
		if (!width) {
			return
		} else if (width < 400 && !collapsed) {
			collapsed = true
		} else if (width > 500 && collapsed) {
			collapsed = false
		}
	})

	let minimal = $derived(field.type === 'info')
	let has_subfields = $derived(field.type === 'group' || field.type === 'repeater')

	let has_condition = $derived(!!field.config?.condition)
	let show_condition_editor = $state(!!field.config?.condition)
	$effect(() => {
		show_condition_editor = !!field.config?.condition
	})

	// enable condition if field has previous siblings without their own condition
	let condition_enabled = $derived(comparable_fields.length > 0)

	let selected_field_type_id = $state<string>()
	$effect.pre(() => {
		selected_field_type_id = visible_field_types.find((ft) => ft.id === field.type)?.id
	})

	// auto-match field-type to entered label (enhanced pattern matching)
	let field_type_changed = $state(false) // but don't overwrite it if the user's already entered it
	function update_field_type(label) {
		if (!label) return 'text'

		const labelLower = label.toLowerCase()
		// Only consider the key if the user explicitly edited it; otherwise it
		// can bias detection (e.g. label 'images' with auto-key 'image').
		const keyLower = key_edited ? field.key?.toLowerCase() || '' : ''
		const combined = `${labelLower} ${keyLower}`

		// 1) Highly specific entity patterns first
		// Page patterns (detect lists before generic repeater)
		if (/\b(page|pages)\b/.test(combined)) {
			// If label implies choosing a type of page, prefer a select
			if (/\btype\b/.test(combined)) return 'select'
			const isList = /\b(list|multiple|many)\b/.test(combined) || pluralize.isPlural(label)
			return isList ? 'page-list' : 'page'
		}

		// Site field patterns
		if (/\b(site|global|config|setting)\b/.test(combined)) return 'site-field'

		// Page field patterns
		if (/\b(page-field|page-content)\b/.test(combined)) return 'page-field'

		// 2) Plural/array heuristic early (after page/site/page-field)
		if (label && pluralize.isPlural(label)) {
			return 'repeater'
		}

		// URL/Link patterns
		if (/\b(url|href|website|domain)\b/.test(combined)) return 'url'
		if (/\b(link)\b/.test(combined)) return 'link'

		// Image patterns
		if (/\b(image|img|photo|picture|avatar|banner|logo)\b/.test(combined)) return 'image'

		// Icon patterns
		if (/\b(icon|emoji)\b/.test(combined)) return 'icon'

		// Date patterns
		if (/\b(date|day|time|when|schedule|deadline|birthday|anniversary|created|updated|published|expired)\b/.test(combined)) return 'date'

		// Number patterns
		if (/\b(number|num|count|quantity|amount|price|cost|age|weight|height|width)\b/.test(combined)) return 'number'

		// Slider patterns (ranges, ratings, percentages)
		if (/\b(rating|range|percent|score|level|opacity|volume)\b/.test(combined)) return 'slider'

		// Boolean/Toggle patterns
		if (/\b(is|has|show|hide|enable|disable|active|visible|featured|toggle)\b/.test(combined)) return 'switch'

		// Select/Choice patterns
		if (/\b(type|category|status|state|option|choice|select)\b/.test(combined)) return 'select'

		// Group patterns (sections, groups)
		if (/\b(group|section|block|area)\b/.test(combined)) return 'group'

		// Markdown patterns
		if (/\b(markdown|md|rich|formatted|wysiwyg|content|body|description|bio|about|summary|details)\b/.test(combined)) {
			return /\b(markdown|md)\b/.test(combined) ? 'markdown' : 'rich-text'
		}

		// Default to text
		return 'text'
	}

	function add_condition() {
		const default_field_id = comparable_fields[0]?.id ?? null
		const next = {
			...(field.config || {}),
			condition: {
				field: default_field_id,
				comparison: '=',
				value: ''
			}
		}
		onchange({ id: field.id, data: { config: next } })
		show_condition_editor = true
	}

	const child_fields = $derived(fields?.filter((f) => f.parent === field.id) || [])

	let is_new_field = $state(field.key === '')
	let should_autofocus = $state(field.key === '')
	let label_input = $state()

	// Focus the label input for new fields
	$effect(() => {
		if (should_autofocus && label_input) {
			tick().then(() => {
				label_input.focus()
			})
		}
	})

	let hide_footer = $derived(!['select', 'image', ...dynamic_field_types].includes(field.type) && !field.config?.condition && !show_condition_editor)
</script>

<div class="top-container" class:top_level class:collapsed>
	<div class="field-container" class:minimal bind:clientWidth={width}>
		<div class="type column-container">
			<UI.Select
				label="Type"
				value={selected_field_type_id}
				options={visible_field_types.map((ft) => ({
					icon: ft.icon,
					value: ft.id,
					label: ft.label
				}))}
				dividers={(() => {
					return hide_dynamic_field_types_context.getOr(false) ? [1, 8] : hide_page_field_field_type_context.getOr(false) ? [1, 8, 9, 11] : [1, 8, 10, 12]
				})()}
				on:input={({ detail: field_type_id }) => {
					field_type_changed = true
					is_new_field = false
					selected_field_type_id = field_type_id

					// Set default config based on field type
					let defaultConfig: unknown = {}
					if (field_type_id === 'page') {
						// Page field requires page_type - get the first available page type
						const firstPageType = page_types[0]?.id || ''
						defaultConfig = { page_type: firstPageType }
					} else if (field_type_id === 'page-list') {
						// Page list might also need page_type
						const firstPageType = page_types[0]?.id || ''
						defaultConfig = { page_type: firstPageType }
					} else {
						defaultConfig = null
					}

					// config updates handled via onchange

					// Optionally auto-fill label (and key) if label is empty & not reference field type (since they autofill the label/key themselves)
					let data: any = { type: field_type_id, config: defaultConfig }
					const has_label = !!(field.label && field.label.trim().length > 0)
					if (!has_label && !['page-field', 'site-field'].includes(field_type_id)) {
						const ft = visible_field_types.find((ft) => ft.id === field_type_id)
						let suggested_label = ft?.label || field_type_id.charAt(0).toUpperCase() + field_type_id.slice(1).replace(/-/g, ' ')
						suggested_label = make_unique_label(suggested_label)
						data.label = suggested_label
						if (!key_edited && (!field.key || field.key.trim() === '')) {
							data.key = validate_field_key(suggested_label)
						}
					}

					onchange({ id: field.id, data })
				}}
				placement="bottom-start"
			/>
			{#if collapsed}
				<div class="field-options">
					{#if $mod_key_held}
						<div class="overlay-actions">
							<button onclick={add_condition} disabled={!condition_enabled}>
								<Icon icon="mdi:show" />
							</button>
							<button onclick={() => onduplicate(field.id)}>
								<Icon icon="bxs:duplicate" />
							</button>
							<button class="delete" onclick={() => ondelete(field)}>
								<Icon icon="ic:outline-delete" />
							</button>
						</div>
					{:else}
						<UI.Dropdown
							size="lg"
							options={[
								{
									label: 'Move up',
									icon: 'material-symbols:arrow-circle-up-outline',
									on_click: () => onmove(field.id, 'up')
								},
								{
									label: 'Move down',
									icon: 'material-symbols:arrow-circle-down-outline',
									on_click: () => onmove(field.id, 'down')
								},
								...(has_condition
									? []
									: [
											{
												label: 'Set condition',
												icon: 'mdi:hide',
												disabled: !condition_enabled,
												on_click: add_condition
											}
										]),
								{
									label: 'Duplicate',
									icon: 'bxs:duplicate',
									on_click: () => onduplicate(field.id)
								},
								{
									label: 'Delete',
									icon: 'ic:outline-delete',
									is_danger: true,
									on_click: () => ondelete(field)
								}
							]}
							placement="bottom-end"
						/>
					{/if}
				</div>
			{/if}
		</div>
		{#if minimal}
			<!-- Just for info field -->
			<div class="main column-container">
				<UI.TextInput
					label="Information"
					value={field.config?.info || ''}
					grow={true}
					placeholder="Something important about the following fields..."
					oninput={(text) => {
						onchange({
							id: field.id,
							data: {
								config: {
									...field.config,
									info: text
								}
							}
						})
					}}
				/>
				{#if !collapsed}
					<div class="field-options">
						{#if $mod_key_held}
							<div class="overlay-actions">
								<button onclick={add_condition} disabled={!condition_enabled}>
									<Icon icon="mdi:show" />
								</button>
								<button onclick={() => onduplicate(field.id)}>
									<Icon icon="bxs:duplicate" />
								</button>
								<button class="delete" onclick={() => ondelete(field)}>
									<Icon icon="ic:outline-delete" />
								</button>
							</div>
						{:else}
							<UI.Dropdown
								size="lg"
								options={[
									{
										label: 'Move up',
										icon: 'material-symbols:arrow-circle-up-outline',
										on_click: () => onmove(field.id, 'up')
									},
									{
										label: 'Move down',
										icon: 'material-symbols:arrow-circle-down-outline',
										on_click: () => onmove(field.id, 'down')
									},
									...(has_condition
										? []
										: [
												{
													label: 'Add Condition',
													icon: 'mdi:show',
													disabled: !condition_enabled,
													on_click: add_condition
												}
											]),
									{
										label: 'Duplicate',
										icon: 'bxs:duplicate',
										on_click: () => onduplicate(field.id)
									},
									{
										label: 'Delete',
										icon: 'ic:outline-delete',
										is_danger: true,
										on_click: () => ondelete(field)
									}
								]}
								placement="bottom-end"
							/>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<div class="column-container">
				<UI.TextInput
					bind:element={label_input}
					label="Label"
					value={field.label}
					placeholder="Heading"
					on:keydown
					oninput={(text) => {
						// Auto-generate key unless user has manually edited it
						let nextType = field.type
						let nextConfig = field.config ?? null

						// Only auto-suggest for truly new fields (no key yet)
						// and when the user hasn't explicitly changed type yet.
						// Allow re-evaluating as the user keeps typing.
						if (is_new_field && !field_type_changed) {
							const suggested = update_field_type(text)
							const is_suggested_visible = visible_field_types.some((ft) => ft.id === suggested)

							// Ignore suggestions that are not visible in this context (e.g. site-field in Site editor)
							if (suggested && suggested !== field.type && is_suggested_visible) {
								nextType = suggested
								// Provide default config for specific types
								if (suggested === 'page' || suggested === 'page-list') {
									const firstPageType = page_types[0]?.id || ''
									if (firstPageType) {
										nextConfig = { page_type: firstPageType }
									} else {
										// If no page types available, cancel switching to invalid type
										nextType = 'text'
										nextConfig = null
									}
								} else {
									nextConfig = null
								}
								// Immediately reflect the auto-selected type in the UI select
								selected_field_type_id = nextType
								// config updates handled via onchange
							}
						}

						onchange({
							id: field.id,
							data: {
								label: text,
								key: key_edited ? field.key : validate_field_key(text),
								type: nextType,
								config: nextConfig
							}
						})

						// Stop focusing after first keystroke but keep new-field behavior
						if (text.length > 0) {
							should_autofocus = false
						}
					}}
				/>
			</div>
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<div class="column-container">
				<UI.TextInput
					label="Key"
					placeholder="heading"
					value={field.key}
					on:keydown
					oninput={(text) => {
						key_edited = true
						is_new_field = false
						onchange({
							id: field.id,
							data: {
								key: validate_field_key(text)
							}
						})
					}}
				/>
				{#if !collapsed}
					<div class="field-options">
						{#if $mod_key_held}
							<div class="overlay-actions">
								<button onclick={add_condition} disabled={!condition_enabled}>
									<Icon icon="mdi:show" />
								</button>
								<button onclick={() => onduplicate(field.id)}>
									<Icon icon="bxs:duplicate" />
								</button>
								<button class="delete" onclick={() => ondelete(field)}>
									<Icon icon="ic:outline-delete" />
								</button>
							</div>
						{:else}
							<UI.Dropdown
								size="lg"
								options={[
									{
										label: 'Move up',
										icon: 'material-symbols:arrow-circle-up-outline',
										on_click: () => onmove(field.id, 'up')
									},
									{
										label: 'Move down',
										icon: 'material-symbols:arrow-circle-down-outline',
										on_click: () => onmove(field.id, 'down')
									},
									...(has_condition
										? []
										: [
												{
													label: 'Add Condition',
													icon: 'mdi:show',
													disabled: !condition_enabled,
													on_click: add_condition
												}
											]),
									{
										label: 'Duplicate',
										icon: 'bxs:duplicate',
										on_click: () => onduplicate(field.id)
									},
									{
										label: 'Delete',
										icon: 'ic:outline-delete',
										is_danger: true,
										on_click: () => ondelete(field)
									}
								]}
								placement="bottom-end"
							/>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
	<div class="footer" class:hidden={hide_footer}>
		{#if field.type === 'select'}
			<SelectField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'image'}
			<ImageFieldOptions
				{field}
				on:input={({ detail }) => {
					const next = { ...(field.config || {}), ...(detail?.config || {}) }
					onchange({ id: field.id, data: { config: next } })
				}}
			/>
		{/if}
		{#if field.type === 'page-field'}
			<PageFieldField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'site-field'}
			<SiteFieldField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'page'}
			<PageField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if field.type === 'page-list'}
			<PageListField
				{field}
				on:input={(event) => {
					onchange({ id: field.id, data: event.detail })
				}}
			/>
		{/if}
		{#if show_condition_editor}
			<Condition
				{field}
				field_to_compare={fields.find((f) => f.id === field.config?.condition?.field)}
				{comparable_fields}
				{collapsed}
				on:input={({ detail: condition }) => {
					const next = { ...(field.config || {}), condition }
					onchange({ id: field.id, data: { config: next } })
				}}
			/>
		{/if}
	</div>

	{#if has_subfields}
		<div class="children-container" style:padding-left="{level + 1}rem">
			{#each child_fields.sort((a, b) => a.index - b.index) as subfield (subfield.id)}
				<FieldItem field={cloneDeep(subfield)} {fields} {create_field} top_level={false} level={level + 1} {onduplicate} {ondelete} {onmove} {onchange} />
			{/each}
			{#if field.type === 'repeater' || field.type === 'group'}
				<button
					class="subfield-button"
					data-level={level}
					onclick={() => {
						if (create_field) {
							create_field({ parent: field.id })
						}
					}}
				>
					<Icon icon="fa-solid:plus" />
					<span>Create {field.label} Subfield</span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style lang="postcss">
	.hidden {
		display: none !important;
	}
	.top-container {
		display: grid;
		gap: 1rem;
		position: relative;

		&.top_level {
			background-color: #1a1a1a;
			padding: 1rem;
			/* border-radius: 6px; */
			/* padding: 24px 24px; */
		}

		&.collapsed {
			padding: 0.5rem;

			.field-container {
				grid-template-columns: 1fr !important;
				gap: 0.75rem;
			}
		}
	}
	.footer {
		display: grid;
		gap: 1rem;
		/* margin-left: 1rem; */
		border-top: 1px solid var(--color-gray-9);
		/* padding-top: 1rem; */
		padding-top: 0.5rem;
		margin-left: 1rem;

		&:empty {
			display: none;
		}
	}
	.field-options {
		display: flex;
		gap: 0.5rem;
		position: relative; /* line up with inputs */
		top: 13px;

		button {
			font-size: 15px;
			padding: 0.5rem;
			border-radius: 0.25rem;
			transition: 0.1s;
			border: 1px solid transparent;
			outline: 0;

			&:hover {
				background: var(--color-gray-8);
			}

			&:focus-visible {
				border-color: var(--primo-primary-color);
				outline: 0;
			}
		}

		button.delete {
			color: var(--primo-color-danger);
			&:hover {
				color: white;
				background: var(--primo-color-danger);
			}
		}
	}
	.overlay-actions {
		padding-top: 3px;
		padding-bottom: 6px;
	}
	.subfield-button {
		width: 100%;
		border-radius: 0.25rem;
		/* margin-top: 10px; */
		padding: 0.5rem 1rem;
		font-size: var(--font-size-1);
		/* background: var(--primo-color-codeblack); */
		background: #292929;
		color: var(--button-color);
		/* background-color: #292929; */
		/* color: var(--color-gray-2); */
		transition: var(--transition-colors);
		outline: 0;
		display: block;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 1px solid transparent;

		&:hover {
			/* background: #333333; */
			background: #292929;
		}

		&:focus-visible {
			border-color: var(--primo-primary-color);
			outline: 0;
		}
	}

	.children-container {
		display: grid;
		gap: 1rem;
		/* margin: 1rem 0; */
		border-color: var(--color-gray-8);
	}

	.column-container {
		display: flex;
		/* flex-direction: column; */
		flex: 1;
		gap: 0.5rem;
	}

	.field-container {
		display: grid;
		grid-template-columns: minmax(150px, 1fr) 3fr 3fr;
		gap: 0.5rem;
		place-items: start normal;

		.type {
			border-radius: 1px;
			display: flex;
			min-width: 3rem;
		}

		&.minimal {
			grid-template-columns: auto 1fr auto;
		}
	}
</style>
