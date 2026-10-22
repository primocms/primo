<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte'
	import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
	import Icon from '@iconify/svelte'
	import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
	import pluralize from 'pluralize'
	import { read_only } from '$lib/pocketbase/author_mode'
	import type { Field } from '$lib/common/models/Field'
	import type { Entry } from '$lib/common/models/Entry'
	import type { Entity } from '$lib/Entity'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'
	import EntryContent from '../components/Fields/EntryContent.svelte'
	import { useEntries } from '$lib/Content.svelte'
	import { mod_key_held } from '../stores/app/misc'
	import { site_context } from '../stores/context'

	const dispatch = createEventDispatcher()

	let {
		entity,
		field,
		entry,
		fields,
		subfields,
		entries,
		index,
		level,
		is_visible,
		autofocus,
		position,
		count,
		scope_key,
		onmove,
		onmove_position,
		onchange,
		ondelete
	}: {
		entity: Entity
		field: Field
		entry: Entry
		fields: Field[]
		subfields: Field[]
		entries: Entry[]
		index: number
		level: number
		is_visible: boolean
		autofocus: boolean
		position: number
		count: number
		scope_key: string
		onmove: (moved_id: string, target_id: string, edge: 'top' | 'bottom') => void
		onmove_position: (position: number) => void
		onchange: FieldValueHandler
		ondelete: (entry_id: string) => void
	} = $props()

	function get_image(subfields) {
		const [first_subfield] = subfields
		if (first_subfield && first_subfield.type === 'image') {
			const [ent] = useEntries(entity, first_subfield, entry) ?? []
			return ent?.value?.url
		} else return null
	}

	function get_icon(subfields) {
		const [first_subfield] = subfields
		if (first_subfield && first_subfield.type === 'icon') {
			const [ent] = useEntries(entity, first_subfield, entry) ?? []
			return ent?.value
		} else return null
	}

	function get_title(subfields) {
		const first_subfield = subfields.find((subfield) => ['text', 'markdown', 'link', 'number', 'page'].includes(subfield.type))
		if (first_subfield) {
			const [ent] = useEntries(entity, first_subfield, entry) ?? []
			if (first_subfield.type === 'link') return ent?.value?.label
			else if (first_subfield.type === 'page') {
				const page = site_context
					.get()
					.value?.pages()
					?.find((p) => p.id === ent?.value)
				return page?.name
			} else return ent?.value
		} else {
			return singular_label
		}
	}

	let element = $state<HTMLDivElement>()
	let drag_handle_element = $state<HTMLButtonElement>()
	let header_element = $state<HTMLDivElement>()
	let hover_position = $state<'top' | 'bottom' | null>(null)
	let dragging = $state(false)
	let menu_open = $state(false)

	$effect(() => {
		if ($read_only || !element || !drag_handle_element || !header_element) return
		const row = element
		const header = header_element
		const cleanup = combine(
			draggable({
				element: row,
				dragHandle: drag_handle_element,
				getInitialData: () => ({ type: 'repeater-item', scope: scope_key, id: entry.id }),
				onDragStart: () => {
					dragging = true
					menu_open = false
				},
				onDrop: () => {
					dragging = false
					hover_position = null
				}
			}),
			dropTargetForElements({
				element: row,
				canDrop: ({ source }) => !$read_only && source.data.type === 'repeater-item' && source.data.scope === scope_key && source.data.id !== entry.id,
				getData: ({ input }) => attachClosestEdge({ id: entry.id }, { element: header, input, allowedEdges: ['top', 'bottom'] }),
				onDrag: ({ self }) => {
					hover_position = extractClosestEdge(self.data) as 'top' | 'bottom' | null
				},
				onDragLeave: () => {
					hover_position = null
				},
				onDrop: ({ self, source, location }) => {
					const edge = extractClosestEdge(self.data)
					hover_position = null
					if (location.current.dropTargets[0]?.element === row && (edge === 'top' || edge === 'bottom')) onmove(source.data.id as string, entry.id, edge)
				}
			})
		)
		return () => {
			cleanup()
			hover_position = null
			dragging = false
			menu_open = false
		}
	})

	async function move_to(position: number) {
		onmove_position(position)
		await tick()
		drag_handle_element?.focus()
	}
	let singular_label = $derived(pluralize.singular(field.label || 'Items'))
	let item_image = $derived(get_image(subfields))
	let item_icon = $derived(get_icon(subfields))
	let item_title = $derived(get_title(subfields))
</script>

<div
	class="RepeaterFieldItem"
	bind:this={element}
	id="repeater-{entry.id}"
	data-entry-id={entry.id}
	class:dragging
	class:hovering-above={hover_position === 'top'}
	class:hovering-below={hover_position === 'bottom'}
>
	<div class="repeater-item-container">
		<div class="item-options" bind:this={header_element}>
			<button
				class="title"
				data-browse-allowed
				ondblclick={() => dispatch('toggleall')}
				onclick={(e) => {
					if ($mod_key_held) {
						dispatch('toggleall')
					} else {
						dispatch('toggle')
					}
				}}
				title={$mod_key_held ? 'Toggle all items' : ''}
			>
				{#if item_image}
					<img src={item_image} alt={item_title || `Preview for item ${index} in ${field.label}`} />
				{:else if item_icon}
					<div style="font-size:1.5rem;">{@html item_icon}</div>
				{:else}
					<span style="white-space: nowrap;text-overflow: ellipsis;overflow: hidden;min-height: 19px;">
						{item_title}
					</span>
				{/if}
				{#if $mod_key_held}
					<span class="key-hint">
						<span>&#8984;</span>
						<Icon icon="fa6-solid:hand-pointer" />
					</span>
				{:else}
					<Icon icon={is_visible ? 'ph:caret-up-bold' : 'ph:caret-down-bold'} />
				{/if}
			</button>
			{#if !$read_only}
				<div class="primo-buttons">
					<DropdownMenu.Root bind:open={menu_open}>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									bind:this={drag_handle_element}
									class="repeater-move"
									title="Rearrange {singular_label}"
									aria-label="Rearrange {item_title || singular_label}"
									onpointerdown={undefined}
									onpointerup={undefined}
									onclick={() => {
										menu_open = !menu_open
									}}
								>
									<Icon icon="material-symbols:drag-handle" />
								</button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content class="z-[999999999] bg-[#171717] text-[#e4e4e7] border-[#292929]">
							<DropdownMenu.Item disabled={position === 0} onSelect={() => move_to(position - 1)}>Move earlier</DropdownMenu.Item>
							<DropdownMenu.Item disabled={position === count - 1} onSelect={() => move_to(position + 1)}>Move later</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item disabled={position === 0} onSelect={() => move_to(0)}>Move to first</DropdownMenu.Item>
							<DropdownMenu.Item disabled={position === count - 1} onSelect={() => move_to(count - 1)}>Move to last</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
					<button title="Delete {singular_label} item" onclick={() => dispatch('remove')}>
						<Icon icon="ion:trash" />
					</button>
				</div>
			{/if}
		</div>
		{#if is_visible}
			<div class="field-values">
				{#each subfields as subfield (subfield.key)}
					<div class="repeater-item-field" id="repeater-{field.key}-{index}-{subfield.key}">
						<EntryContent
							{entity}
							parent={entry}
							field={subfield}
							{fields}
							{entries}
							level={level + 1}
							minimal={true}
							onchange={(values) => onchange({ [field.key ?? '']: { [index]: { value: null, subValues: values } } })}
							{ondelete}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.RepeaterFieldItem.dragging {
		opacity: 0.5;
	}
	:global(.repeater-move) {
		cursor: grab;
		touch-action: manipulation;
		padding: 0.25rem;
	}
	:global(.repeater-move:focus-visible) {
		outline: 2px solid var(--primo-primary-color);
		outline-offset: 2px;
	}
	.RepeaterFieldItem {
		border-top: 1px solid transparent;
		border-bottom: 1px solid transparent;
		transition: 0.1s;
		padding-block: 0.5rem;

		&.hovering-above {
			border-top-color: var(--primo-primary-color);
		}

		&.hovering-below {
			border-bottom-color: var(--primo-primary-color);
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
				grid-template-columns: auto 1fr auto;
				gap: 1rem;
				align-items: center;
				text-align: left;

				img {
					width: 3rem;
					border-radius: 2px;
					aspect-ratio: 1;
					object-fit: cover;
				}

				.key-hint {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 0.25rem;
					font-size: 0.75rem;
				}
			}

			.primo-buttons button {
				&:focus {
					/* outline: 0; */
				}
				&:hover {
					color: var(--primo-primary-color);
				}
				&:last-child {
					margin-left: 0.5rem;
					color: var(--color-gray-5);

					&:hover {
						color: var(--primo-primary-color);
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
