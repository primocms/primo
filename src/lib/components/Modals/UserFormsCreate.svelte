<script>
	import UserFormsCreate from './UserFormsCreate.svelte';
	import { find as _find, chain as _chain, cloneDeep as _cloneDeep } from 'lodash-es'
	import Icon from '@iconify/svelte'
	import { createEventDispatcher, onDestroy, tick } from 'svelte'
	import { createUniqueID } from '$lib/builder/utilities'
	import fieldTypes from '$lib/builder/stores/app/fieldTypes'
	import { get_empty_value } from '$lib/builder/utils'

	// idb crashes chrome (try primo, server)
	// import * as idb from 'idb-keyval'
	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} label
	 * @property {any} field
	 * @property {number} [level]
	 * @property {boolean} [show_label]
	 * @property {any} [hidden_keys]
	 */

	/** @type {Props} */
	let {
		label,
		field = $bindable(),
		level = 0,
		show_label = false,
		hidden_keys = []
	} = $props();

	function add_repeater_item() {
		const subfield = createSubfield()
		visibleRepeaters[`${field.key}-${repeaterFieldValues.length}`] = true
		field.fields = [...field.fields, subfield]
		dispatch('add', subfield)
		onInput()
	}

	function removeRepeaterItem(itemIndex) {
		dispatch('remove')
		field.fields = field.fields.filter((_, i) => i !== itemIndex)
		onInput()
	}

	function moveRepeaterItem(indexOfItem, direction) {
		const item = repeaterFieldValues[indexOfItem]
		const withoutItem = repeaterFieldValues.filter((_, i) => i !== indexOfItem)
		if (direction === 'up') {
			field.fields = [...withoutItem.slice(0, indexOfItem - 1), item, ...withoutItem.slice(indexOfItem - 1)]
		} else if (direction === 'down') {
			field.fields = [...withoutItem.slice(0, indexOfItem + 1), item, ...withoutItem.slice(indexOfItem + 1)]
		} else {
			console.error('Direction must be up or down')
		}
		onInput()
	}

	function createSubfield() {
		return field.fields.map((subfield) => ({
			...subfield,
			id: createUniqueID(),
			value: get_empty_value(subfield)
		}))
	}

	let repeaterFieldValues = $state([])

	async function getRepeaterFieldValues() {
		await tick() // need to wait for $locale to change parent content
		return field.value.map((value) =>
			field.fields.map((subfield) => ({
				...subfield,
				fields: _cloneDeep(
					subfield.fields.map((sub) => ({
						...sub,
						value: value[subfield.key]?.[sub.key]
					}))
				),
				value: value[subfield.key]
			}))
		)
	}

	function setTemplateKeys(val) {
		repeaterFieldValues = val.map((f) => {
			f._key = f._key || createUniqueID()
			return f
		})
	}

	function onInput() {
		field.value = repeaterFieldValues.map((items, i) => _chain(items).keyBy('key').mapValues('value').value())

		dispatch('input', field)
	}

	function getFieldComponent(subfield) {
		const field = _find($fieldTypes, ['id', subfield.type])
		return field ? field.component : null
	}

	function getImage(repeaterItem) {
		const [firstField] = repeaterItem
		if (firstField && firstField.type === 'image') {
			return firstField.value.url
		} else return null
	}

	let visibleRepeaters = $state({})
	// idb.get(field.id).then((res) => {
	// 	if (res) {
	// 		visibleRepeaters = res
	// 	}
	// })

	// onDestroy(() => {
	// 	// save visible repeaters
	// 	idb.set(field.id, _cloneDeep(visibleRepeaters))
	// })

	function getTitle(repeaterItem) {
		console.log({ repeaterItem })
		const firstField = repeaterItem.find((subfield) => ['text', 'link', 'number'].includes(subfield.type))
		if (firstField) {
			let { value } = repeaterItem[0]
			if (firstField.type === 'link') return value?.label
			else if (firstField.type === 'markdown') return value?.markdown
			else return value
		} else {
			return repeaterItem.label
		}
	}

	const creation_fields = [
		{
			key: 'name',
			type: 'text',
			value: '',
			label: 'Label'
		},
		{
			key: 'placeholder',
			type: 'text',
			value: '',
			label: 'Placeholder'
		},
		{
			key: 'type',
			type: 'select',
			value: '',
			options: {
				options: [
					{
						value: 'text',
						label: 'Text'
					},
					{
						value: 'textarea',
						label: 'Text Ara'
					},
					{
						label: 'Phone Number',
						value: 'tel'
					}
				]
			},
			label: 'Type'
		},
		{
			key: 'required',
			type: 'switch',
			value: false,
			label: 'Required'
		}
	]
	// getRepeaterFieldValues().then((val) => (repeaterFieldValues = val))

	// $: getRepeaterFieldValues().then((val) => (repeaterFieldValues = val))
	$effect(() => {
		setTemplateKeys(repeaterFieldValues)
	});
</script>

<div class="RepeaterField repeater-level-{level}">
	{#if show_label}
		<p class="label">{label}</p>
	{/if}
	<div class="fields">
		{#each field.fields as child_field, i}
			{@const subfieldID = `${field.key}-${i}`}
			{@const itemTitle = getTitle(child_field, field)}
			<div class="repeater-item" id="repeater-{child_field.key}-{i}">
				<div class="item-options">
					<button class="title" onclick={() => (visibleRepeaters[subfieldID] = !visibleRepeaters[subfieldID])}>
						<span>{itemTitle}</span>
						<Icon icon={visibleRepeaters[subfieldID] ? 'ph:caret-up-bold' : 'ph:caret-down-bold'} />
					</button>
					<div class="primo-buttons">
						{#if i !== 0}
							<button title="Move Item up" onclick={() => moveRepeaterItem(i, 'up')}>
								<Icon icon="mdi:arrow-up" />
							</button>
						{/if}
						{#if i !== repeaterFieldValues.length - 1}
							<button title="Move Item down" onclick={() => moveRepeaterItem(i, 'down')}>
								<Icon icon="mdi:arrow-down" />
							</button>
						{/if}
						<button title="Delete Item item" onclick={() => removeRepeaterItem(i)}>
							<Icon icon="ion:trash" />
						</button>
					</div>
				</div>
				{#if visibleRepeaters[subfieldID]}
					<div class="field-values">
						{#each creation_fields as subfield}
							{#if !hidden_keys.includes(subfield.key)}
								<div class="repeater-item-field" id="repeater-{field.key}-{i}-{subfield.key}">
									{#if subfield.type === 'repeater'}
										<UserFormsCreate field={subfield} on:input={onInput} level={level + 1} visible={true} show_label={true} />
									{:else}
										{@const SvelteComponent = getFieldComponent(subfield)}
										<SvelteComponent field={subfield} level={level + 1} on:input={onInput} />
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
		<button class="field-button" onclick={add_repeater_item}>
			<Icon icon="akar-icons:plus" />
			<span>Add New Item</span>
		</button>
	</div>
</div>

<style lang="postcss">
	.RepeaterField {
		width: 100%;
	}
	.fields {
		display: grid;
		gap: 1.5rem;
	}

	.label {
		font-size: var(--title-font-size, 1rem);
		font-weight: var(--title-font-weight, 700);
		padding-bottom: 1rem;
		letter-spacing: 1px;
	}

	.repeater-level-0 {
		--field-border-color: #252627;
	}

	.repeater-level-1 {
		--field-border-color: #3e4041;
	}

	.repeater-level-2 {
		--field-border-color: #58595b;
	}

	.repeater-level-3 {
		--field-border-color: #888;
	}

	.repeater-level-4 {
		--field-border-color: #aaa;
	}

	.repeater-level-5 {
		--field-border-color: #ccc;
	}

	.repeater-level-5 {
		--field-border-color: #eee;
	}

	.repeater-item {
		flex: 1;
		padding-left: 1.5rem;
		border-left: 0.5rem solid var(--field-border-color, #252627);
		display: grid;
		gap: 1.5rem;
		position: relative;
		border-radius: 1px;
		min-width: 10rem;

		--label-font-size: 0.875rem;
		--label-font-weight: 400;

		&:last-of-type {
			margin-bottom: 0;
		}

		.item-options {
			transition: 0.1s padding, 0.1s border-color;
			font-size: var(--title-font-size);
			font-weight: var(--title-font-weight);
			border-bottom: 1px solid transparent;
			display: flex;
			gap: 1rem;
			justify-content: space-between;
			align-items: center;
			color: var(--color-gray-2);

			.primo-buttons {
				white-space: nowrap;
			}

			&:not(:only-child) {
				border-bottom: var(--input-border);
				padding-bottom: 0.75rem;
			}

			button.title {
				padding: 0.5rem 0;
				display: flex;
				gap: 1rem;
				align-items: center;
				text-align: left;

				img {
					width: 3rem;
					border-radius: 2px;
				}
			}

			.primo-buttons button {
				&:focus {
					/* outline: 0; */
				}
				&:hover {
					color: var(--primo-color-brand);
				}
				&:last-child {
					margin-left: 0.5rem;
					color: var(--color-gray-5);

					&:hover {
						color: var(--primo-color-brand);
					}
				}
			}
		}

		.field-values {
			display: grid;
			gap: 0.5rem;

			.repeater-label {
				display: block;
				font-size: var(--title-font-size);
				font-weight: var(--title-font-weight);
				margin-bottom: 1rem;
			}
		}
	}
	.repeater-item-field {
		margin-bottom: 0.5rem;
	}
	.repeater-item-field:not(:first-child) {
		padding-top: 0;
	}
	button.field-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		background: var(--primo-button-background);
		color: var(--button-color);
		padding: 0.5rem 0;
		border-radius: 1px;
		transition: background 0.1s, color 0.1s;

		font-size: 0.875rem;
		padding: 0.75rem;
		border-radius: 4px;
		font-weight: 700;

		&:hover {
			background: var(--button-hover-color);
		}

		/* &[disabled] {
      background: var(--color-gray-5);
      cursor: not-allowed;
    } */
	}
</style>
