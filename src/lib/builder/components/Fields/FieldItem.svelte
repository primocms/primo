<script>
	import FieldItem from './FieldItem.svelte'
	import _, { cloneDeep, chain as _chain } from 'lodash-es'
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
	import fieldTypes from '../../stores/app/fieldTypes.js'
	import { dynamic_field_types } from '$lib/builder/field-types'
	import { pluralize } from '../../field-types/RepeaterField.svelte'
	import { getContext } from 'svelte'
	import { get_empty_value } from '$lib/builder/utils'

	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} field
	 * @property {any} fields
	 * @property {number} [level]
	 * @property {boolean} [top_level]
	 */

	/** @type {Props} */
	let { field = $bindable(), fields, level = 0, top_level = true } = $props()

	const visible_field_types = getContext('hide_dynamic_field_types') ? $fieldTypes.filter((ft) => !dynamic_field_types.includes(ft.id)) : $fieldTypes

	let comparable_fields = $derived(
		fields
			.filter((f) => {
				const is_valid_type = ['text', 'number', 'switch', 'url', 'select'].includes(f.type)
				const is_previous_sibling = f.parent === field.parent && f.index < field.index
				return is_valid_type && is_previous_sibling
			})
			.sort((a, b) => a.index - b.index)
	)

	function dispatch_update(data) {
		dispatch('input', { id: field.id, data })
	}

	function validate_field_key(key) {
		// replace dash and space with underscore
		return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
	}

	// Auto-fill key when setting label
	let key_edited = $state(false)

	// autosize info textarea
	let info_textarea
	$effect(() => {
		if (info_textarea) {
			autosize(info_textarea)
		}
	})

	let width = $state()
	let collapsed = $state(false)
	$effect(() => {
		if (width < 400 && !collapsed) {
			collapsed = true
		} else if (width > 500 && collapsed) {
			collapsed = false
		}
	})

	let minimal = $derived(field.type === 'info')
	let has_subfields = $derived(field.type === 'group' || field.type === 'repeater')
	let has_condition = $derived(field.options.condition)

	// enable condition if field has previous siblings without their own condition
	let condition_enabled = $derived(!field.parent && fields.filter((f) => f.parent === field.parent && f.id !== field.id && f.index < field.index && !f.options.condition).length > 0)

	let selected_field_type_id = $state('')
	$effect.pre(() => {
		selected_field_type_id = visible_field_types.find((ft) => ft.id === field.type)?.id
	})

	// auto-match field-type to entered label (e.g. [Plural], Icon, Image, Link)
	let field_type_changed = $state(false) // but don't overwrite it if the user's already entered it
	function update_field_type(label) {
		label = label.toLowerCase()
		if (label && $pluralize.isPlural(label)) {
			return 'repeater'
		} else if (label.includes('icon')) {
			return 'icon'
		} else if (label.includes('image')) {
			return 'image'
		} else if (label.includes('link')) {
			return 'link'
		} else if (label.includes('type')) {
			return 'select'
		} else if (label.includes('group')) {
			return 'group'
		} else if (label.includes('toggle')) {
			return 'toggle'
		} else return 'text'
	}

	function add_condition() {
		const default_field = comparable_fields[0]
		dispatch_update({
			options: {
				...field.options,
				condition: {
					field: default_field.id,
					comparison: '=',
					value: get_empty_value(default_field)
				}
			}
		})
	}

	let child_fields = $derived(fields.filter((f) => f.parent === field.id))

	let is_new_field = $state(field.key === '')

	let hide_footer = $derived(!['select', ...dynamic_field_types].includes(field.type) && !field.options.condition)
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
				dividers={[1, 8, 10, 12]}
				on:input={({ detail: field_type_id }) => {
					console.log({ field_type_id })
					field_type_changed = true
					selected_field_type_id = field_type_id
					dispatch_update({
						type: field_type_id
					})
				}}
				placement="bottom-start"
			/>
			{#if collapsed}
				<div class="field-options">
					{#if $mod_key_held}
						<button onclick={add_condition}>
							<Icon icon="mdi:show" />
						</button>
						<button onclick={() => dispatch('duplicate', field)}>
							<Icon icon="bxs:duplicate" />
						</button>
						<button class="delete" onclick={() => dispatch('delete', field)}>
							<Icon icon="ic:outline-delete" />
						</button>
					{:else}
						<UI.Dropdown
							size="lg"
							options={[
								{
									label: 'Move up',
									icon: 'material-symbols:arrow-circle-up-outline',
									on_click: () => dispatch('move', { direction: 'up', field })
								},
								{
									label: 'Move down',
									icon: 'material-symbols:arrow-circle-down-outline',
									on_click: () => dispatch('move', { direction: 'down', field })
								},
								...(has_condition
									? []
									: [
											{
												label: 'Set condition',
												icon: 'mdi:hide',
												disabled: !condition_enabled,
												on_click: () => {
													add_condition()
												}
											}
										]),
								{
									label: 'Duplicate',
									icon: 'bxs:duplicate',
									on_click: () => dispatch('duplicate', field)
								},
								{
									label: 'Delete',
									icon: 'ic:outline-delete',
									is_danger: true,
									on_click: () => dispatch('delete', field)
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
					value={field.options.info || ''}
					autogrow={true}
					placeholder="Something important about the following fields..."
					oninput={(text) => {
						dispatch_update({
							options: {
								...field.options,
								info: text
							}
						})
					}}
				/>
				{#if !collapsed}
					<div class="field-options">
						{#if $mod_key_held}
							<button onclick={add_condition}>
								<Icon icon="mdi:show" />
							</button>
							<button onclick={() => dispatch('duplicate', field)}>
								<Icon icon="bxs:duplicate" />
							</button>
							<button class="delete" onclick={() => dispatch('delete', field)}>
								<Icon icon="ic:outline-delete" />
							</button>
						{:else}
							<UI.Dropdown
								size="lg"
								options={[
									{
										label: 'Move up',
										icon: 'material-symbols:arrow-circle-up-outline',
										on_click: () => dispatch('move', { direction: 'up', field })
									},
									{
										label: 'Move down',
										icon: 'material-symbols:arrow-circle-down-outline',
										on_click: () => dispatch('move', { direction: 'down', field })
									},
									...(has_condition
										? []
										: [
												{
													label: 'Add Condition',
													icon: 'mdi:show',
													on_click: () => {
														add_condition()
													}
												}
											]),
									{
										label: 'Duplicate',
										icon: 'bxs:duplicate',
										on_click: () => dispatch('duplicate', field)
									},
									{
										label: 'Delete',
										icon: 'ic:outline-delete',
										is_danger: true,
										on_click: () => dispatch('delete', field)
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
					label="Label"
					value={field.label}
					placeholder="Heading"
					autofocus={is_new_field}
					on:keydown
					oninput={(text) => {
						// only auto-set key and type on new fields
						dispatch_update({
							label: text,
							key: key_edited || !is_new_field ? field.key : validate_field_key(text),
							type: field_type_changed || !is_new_field ? field.type : update_field_type(text)
						})
					}}
					on:blur={() => (is_new_field = false)}
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
						dispatch_update({
							key: validate_field_key(text)
						})
					}}
				/>
				{#if !collapsed}
					<div class="field-options">
						{#if $mod_key_held}
							<button onclick={add_condition}>
								<Icon icon="mdi:show" />
							</button>
							<button onclick={() => dispatch('duplicate', field)}>
								<Icon icon="bxs:duplicate" />
							</button>
							<button class="delete" onclick={() => dispatch('delete', field)}>
								<Icon icon="ic:outline-delete" />
							</button>
						{:else}
							<UI.Dropdown
								size="lg"
								options={[
									{
										label: 'Move up',
										icon: 'material-symbols:arrow-circle-up-outline',
										on_click: () => dispatch('move', { direction: 'up', field })
									},
									{
										label: 'Move down',
										icon: 'material-symbols:arrow-circle-down-outline',
										on_click: () => dispatch('move', { direction: 'down', field })
									},
									...(has_condition
										? []
										: [
												{
													label: 'Add Condition',
													icon: 'mdi:show',
													on_click: () => {
														add_condition()
													}
												}
											]),
									{
										label: 'Duplicate',
										icon: 'bxs:duplicate',
										on_click: () => dispatch('duplicate', field)
									},
									{
										label: 'Delete',
										icon: 'ic:outline-delete',
										is_danger: true,
										on_click: () => dispatch('delete', field)
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
				{level}
				on:input={({ detail: updated_field }) => {
					console.log({ updated_field })
					dispatch_update(updated_field)
				}}
			/>
		{/if}
		{#if field.type === 'page-field'}
			<PageFieldField {field} on:input={({ detail }) => dispatch_update({ source: detail })} />
		{/if}
		{#if field.type === 'site-field'}
			<SiteFieldField {field} oninput={(detail) => dispatch_update({ source: detail })} />
		{/if}
		{#if field.type === 'page'}
			<PageField {field} on:input={({ detail }) => dispatch_update({ options: detail })} />
		{/if}
		{#if field.type === 'page-list'}
			<PageListField {field} oninput={(options) => dispatch_update({ options })} />
		{/if}
		{#if field.options.condition}
			<Condition
				{field}
				field_to_compare={fields.find((f) => f.id === field.options.condition.field)}
				{comparable_fields}
				{collapsed}
				on:input={({ detail: condition }) => {
					console.log({ condition })
					dispatch_update({ options: { ...field.options, condition } })
				}}
			/>
		{/if}
	</div>

	{#if has_subfields}
		<div class="children-container" style:padding-left="{level + 1}rem">
			{#each child_fields.sort((a, b) => a.index - b.index) as subfield (subfield.id)}
				<FieldItem field={cloneDeep(subfield)} {fields} top_level={false} level={level + 1} on:duplicate on:delete on:move on:createsubfield on:keydown on:input />
			{/each}
			{#if field.type === 'repeater' || field.type === 'group'}
				<button class="subfield-button" data-level={level} onclick={() => dispatch('createsubfield', field)}>
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
		margin-top: 1rem; /* line up with inputs */

		button {
			font-size: 15px;
			padding: 0.5rem;
			border-radius: 0.25rem;
			transition: 0.1s;

			&:hover {
				background: var(--color-gray-8);
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
	.subfield-button {
		width: 100%;
		border-radius: 0.25rem;
		/* margin-top: 10px; */
		padding: 0.5rem 1rem;
		font-size: var(--font-size-2);
		/* background: #1f1f1f; */
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
			border-color: var(--weave-primary-color);
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

		&.collapsed .minimal {
			.main {
				grid-column: 1 / span 2;
			}
		}

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
