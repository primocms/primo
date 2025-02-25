<script>
	import IconPicker from '../../components/IconPicker.svelte'
	import UI from '../../ui/index.js'
	import Icon from '@iconify/svelte'
	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	let { field } = $props()

	let options = $derived(field.options?.options || [])

	function update_option(updated_option, i) {
		const updated_options = options.map((opt, index) => (index === i ? updated_option : opt))
		dispatch_update(updated_options)
	}

	function validateFieldKey(key) {
		// replace dash and space with underscore
		return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
	}

	function create_option() {
		dispatch_update([
			...options,
			{
				icon: '',
				label: '',
				value: ''
			}
		])
	}

	function move_option(indexOfItem, direction) {
		const item = options[indexOfItem]
		const withoutItem = options.filter((_, i) => i !== indexOfItem)
		let updated_options
		if (direction === 'up') {
			updated_options = [...withoutItem.slice(0, indexOfItem - 1), item, ...withoutItem.slice(indexOfItem - 1)]
		} else if (direction === 'down') {
			updated_options = [...withoutItem.slice(0, indexOfItem + 1), item, ...withoutItem.slice(indexOfItem + 1)]
		} else {
			console.error('Direction must be up or down')
		}
		dispatch_update(updated_options)
	}

	function delete_option(itemIndex) {
		dispatch_update(options.filter((_, i) => i !== itemIndex))
	}

	function dispatch_update(updated_options) {
		dispatch('input', { options: { ...field.options, options: updated_options } })
	}

	// track focused value inputs to auto-fill values when unedited
	const clicked_value_inputs = new Set()
</script>

<!-- <div class="SelectField" style="margin-left: {1.5 + level}rem"> -->
<div class="SelectField">
	{#if options}
		{#each options as option, i}
			<div class="select-field">
				<div class="option-icon">
					<span class="primo--field-label">Icon</span>
					<IconPicker variant="small" search_query={option.label} icon={option.icon || 'ri:checkbox-blank-circle-fill'} on:input={({ detail: icon }) => update_option({ ...option, icon }, i)} />
				</div>
				<UI.TextInput
					label="Option Label"
					value={option.label}
					autofocus={option.label.length === 0}
					oninput={(text) => {
						update_option(
							{
								...option,
								value: clicked_value_inputs.has(i) ? option.value : validateFieldKey(text),
								label: text
							},
							i
						)
					}}
				/>
				<UI.TextInput
					label="Option Value"
					value={option.value}
					onfocus={() => clicked_value_inputs.add(i)}
					oninput={(text) => {
						update_option(
							{
								...option,
								value: text
							},
							i
						)
					}}
				/>
				<div class="item-options" id="repeater-{field.key}-{i}">
					{#if i !== 0}
						<button title="Move {field.label} up" onclick={() => move_option(i, 'up')}>
							<Icon icon="fa-solid:arrow-up" />
						</button>
					{/if}
					{#if i !== options.length - 1}
						<button title="Move {field.label} down" onclick={() => move_option(i, 'down')}>
							<Icon icon="fa-solid:arrow-down" />
						</button>
					{/if}
					<button style="color: var(--primo-color-danger)" title="Delete {field.label} item" onclick={() => delete_option(i)}>
						<Icon icon="ion:trash" />
					</button>
				</div>
			</div>
		{/each}
	{/if}
	<button class="field-button subfield-button" onclick={create_option}>
		<Icon icon="ic:baseline-plus" />
		Create Option
	</button>
</div>

<style lang="postcss">
	.SelectField {
		display: grid;
		gap: 1rem;
		/* margin-left: 1rem; */
	}
	.select-field {
		display: grid;
		grid-template-columns: auto 1fr 1fr auto;
		grid-gap: 1rem;
		gap: 0.5rem;
	}
	.option-icon {
		display: grid;
		align-items: flex-end;
	}
	.field-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		background: var(--color-gray-7);
		color: var(--color-gray-3);
		padding: 8px 0;
		border-bottom-right-radius: var(--primo-border-radius);
		border-bottom-left-radius: var(--primo-border-radius);
		transition: var(--transition-colors);
	}
	.field-button:hover {
		background: var(--color-gray-9);
	}
	.field-button.subfield-button {
		border-radius: 4px;
		/* margin-top: 8px;
		margin-bottom: 8px; */
		font-size: var(--font-size-2);
		background: var(--primo-color-codeblack);
		color: var(--color-gray-2);
		transition: var(--transition-colors);
		outline: 0;
	}
	.field-button.subfield-button:hover {
		background: var(--color-gray-8);
	}
	.field-button.subfield-button:focus {
		/* background: var(--color-gray-8); */
		border-color: var(--weave-primary-color);
		outline: 0;
	}
	.item-options {
		display: flex;
		align-items: center;
		margin-top: 15px; /* to align with inputs */
		justify-content: flex-end;
		/* gap: 0.25rem; */

		button {
			padding: 0.5rem 9px; /* align with inputs */
			transition: 0.1s;
			border-radius: var(--primo-border-radius);

			&:hover {
				background: var(--color-gray-8);
			}
		}
	}
</style>
