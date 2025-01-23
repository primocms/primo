<script module>
	import { writable } from 'svelte/store'
	export const pluralize = writable(null)
	import('../libraries/pluralize').then((mod) => pluralize.set(mod.default))
</script>

<script>
	import { createEventDispatcher } from 'svelte'
	import _ from 'lodash-es'
	import { onMount } from 'svelte'
	import Icon from '@iconify/svelte'
	import { is_regex } from '../utils'
	import { fieldTypes } from '../stores/app'

	const dispatch = createEventDispatcher()

	let {
		repeater_item,
		field,
		subfields,
		fields,
		entries,
		index,
		level,
		is_visible,
		autofocus,
		hovering,
		hover_position,
		oninput = /** @type {(val: {id: string, data: any}) => void} */ () => {}
	} = $props()

	function getFieldComponent(subfield) {
		const field = _.find($fieldTypes, ['id', subfield.type])
		return field ? field.component : null
	}

	function get_content_entry(subfield) {
		const entry = entries.find((e) => e.field === subfield.id && e.parent === repeater_item.id)
		return entry
	}

	function get_image(repeater_item) {
		const [first_subfield] = subfields
		if (first_subfield && first_subfield.type === 'image') {
			const content_entry = entries.find((r) => r.field === first_subfield.id && r.parent === repeater_item.id)
			return content_entry?.value?.url
		} else return null
	}

	function get_icon(repeater_item) {
		const [first_subfield] = subfields
		if (first_subfield && first_subfield.type === 'icon') {
			const content_entry = entries.find((r) => r.field === first_subfield.id && r.parent === repeater_item.id)
			return content_entry?.value
		} else return null
	}

	function get_title(repeater_item) {
		const first_subfield = subfields.find((subfield) => ['text', 'markdown', 'link', 'number'].includes(subfield.type))
		if (first_subfield) {
			// let { value } = subfields[0]
			const content_entry = entries.find((r) => r.field === first_subfield.id && r.parent === repeater_item.id)
			if (first_subfield.type === 'link') return content_entry?.value?.label
			else if (first_subfield.type === 'markdown') return content_entry?.value?.markdown
			else return content_entry?.value
		} else {
			return singular_label
		}
	}

	function check_condition(field, entry) {
		if (!field.options.condition) return true // has no condition

		const { field: field_id, value, comparison } = field.options.condition
		const field_to_compare = fields.find((f) => f.id === field_id)
		if (!field_to_compare) {
			// field has been deleted, reset condition
			field.options.condition = null
			return false
		}

		const { value: comparable_value } = entries.find((e) => e.field === field_id && e.parent === entry.parent)
		if (is_regex(value)) {
			const regex = new RegExp(value.slice(1, -1))
			if (comparison === '=' && regex.test(comparable_value)) {
				return true
			} else if (comparison === '!=' && !regex.test(comparable_value)) {
				return true
			}
		} else if (comparison === '=' && value === comparable_value) {
			return true
		} else if (comparison === '!=' && value !== comparable_value) {
			return true
		}
		return false
	}

	let drag_handle_element = $state()
	let element = $state()

	onMount(async () => {
		const { draggable, dropTargetForElements } = await import('$lib/builder/libraries/pragmatic-drag-and-drop/adapter/element-adapter')
		const { attachClosestEdge, extractClosestEdge } = await import('$lib/builder/libraries/pragmatic-drag-and-drop-hitbox/closest-edge')
		draggable({
			element,
			dragHandle: drag_handle_element,
			getInitialData: () => ({ item: repeater_item })
		})
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ item: repeater_item },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDrag({ self, source }) {
				dispatch('hover', extractClosestEdge(self.data))
			},
			onDragLeave() {
				dispatch('hover', null)
			},
			onDrop({ self, source }) {
				const item_dragged_over = self.data.item
				const item_being_dragged = source.data.item
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				// if (item_dragged_over.index === 0) return // can't place above home

				if (closestEdgeOfTarget === 'top') {
					// actions.rearrange(item_being_dragged, item_dragged_over.index)
					dispatch('move', { item: item_being_dragged, new_index: item_dragged_over.index })
				} else if (closestEdgeOfTarget === 'bottom') {
					dispatch('move', { item: item_being_dragged, new_index: item_dragged_over.index + 1 })
					// actions.rearrange(item_being_dragged, item_dragged_over.index + 1)
				}
				dispatch('hover', null)
			}
		})
	})
	let singular_label = $derived($pluralize && $pluralize?.singular(field.label))
	let item_image = $derived(get_image(repeater_item, field))
	let item_icon = $derived(get_icon(repeater_item, field))
	let item_title = $derived(get_title(repeater_item, field))
</script>

<div
	class="RepeaterFieldItem"
	bind:this={element}
	id="repeater-{field.key}-{index}"
	class:hovering-above={hovering && hover_position === 'top'}
	class:hovering-below={hovering && hover_position === 'bottom'}
>
	<div class="repeater-item-container">
		<div class="item-options">
			<button class="title" onclick={() => dispatch('toggle')}>
				{#if item_image}
					<img src={item_image} alt={item_title || `Preview for item ${index} in ${field.label}`} />
				{:else if item_icon}
					<div style="font-size:1.5rem;">{@html item_icon}</div>
				{:else}
					<span style="white-space: nowrap;text-overflow: ellipsis;overflow: hidden;min-height: 19px;">
						{item_title}
					</span>
				{/if}
				<Icon icon={is_visible ? 'ph:caret-up-bold' : 'ph:caret-down-bold'} />
			</button>
			<div class="primo-buttons">
				<button bind:this={drag_handle_element}>
					<Icon icon="material-symbols:drag-handle" />
				</button>
				<button title="Delete {singular_label} item" onclick={() => dispatch('remove', repeater_item)}>
					<Icon icon="ion:trash" />
				</button>
			</div>
		</div>
		{#if is_visible}
			<div class="field-values">
				{#each subfields as subfield, subfield_index (repeater_item._key + subfield.key)}
					{@const content_entry = get_content_entry(subfield)}
					{@const is_visible = check_condition(subfield, content_entry)}
					{#if is_visible}
						{@const SvelteComponent = getFieldComponent(subfield)}
						<div class="repeater-item-field" id="repeater-{field.key}-{index}-{subfield.key}">
							<SvelteComponent
								id={content_entry.id}
								value={content_entry.value}
								metadata={content_entry.metadata}
								field={subfield}
								{fields}
								{entries}
								level={level + 1}
								show_label={true}
								autofocus={autofocus && subfield_index === 0}
								on:keydown
								on:add
								on:remove
								on:move
								oninput={(detail) => {
									if (detail.id) {
										oninput(detail)
									} else {
										oninput({ id: content_entry.id, data: detail })
									}
								}}
							/>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.RepeaterFieldItem {
		border-top: 1px solid transparent;
		border-bottom: 1px solid transparent;
		transition: 0.1s;
		padding-block: 0.5rem;

		&.hovering-above {
			border-top-color: var(--primo-color-brand);
		}

		&.hovering-below {
			border-bottom-color: var(--primo-color-brand);
		}
	}

	.repeater-item-container {
		flex: 1;
		padding-left: 1.5rem;
		border-left: 0.5rem solid var(--field-border-color, #252627);
		display: grid;
		gap: 1rem;
		position: relative;
		border-radius: 1px;
		min-width: 10rem;

		--label-font-size: 0.875rem;
		--label-font-weight: 400;

		&:last-of-type {
			margin-bottom: 0;
		}

		.item-options {
			transition:
				0.1s padding,
				0.1s border-color;
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
				/* padding-bottom: 0.75rem; */
			}

			button.title {
				padding: 0.5rem 0;
				display: grid;
				grid-template-columns: auto 1fr;
				gap: 1rem;
				align-items: center;
				text-align: left;

				img {
					width: 3rem;
					border-radius: 2px;
					aspect-ratio: 1;
					object-fit: cover;
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
		}
	}
	.repeater-item-field {
		margin-bottom: 0.5rem;
	}
	.repeater-item-field:not(:first-child) {
		padding-top: 0;
	}
</style>
