<script lang="ts">
	import { createEventDispatcher } from 'svelte'
	import Icon from '@iconify/svelte'
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
	import { is_entity_of } from '$lib/Entity'
	import { LibraryUploads, SiteUploads } from '$lib/pocketbase/collections'
	import { self } from '$lib/pocketbase/managers'

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
		can_move_up,
		can_move_down,
		onmove,
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
		can_move_up: boolean
		can_move_down: boolean
		onmove: (direction: -1 | 1) => void
		onchange: FieldValueHandler
		ondelete: (entry_id: string) => void
	} = $props()

	function get_image_entry(subfields: Field[]) {
		const [first_subfield] = subfields
		if (first_subfield && first_subfield.type === 'image') {
			const [ent] = useEntries(entity, first_subfield, entry) ?? []
			return ent
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

	let singular_label = $derived(pluralize.singular(field.label))
	const image_entry = $derived(get_image_entry(subfields))
	const is_library_image = $derived(is_entity_of(entity, 'library_symbols'))
	const image_upload = $derived(image_entry?.value?.upload ? (is_library_image ? LibraryUploads : SiteUploads).one(image_entry.value.upload) : null)
	const image_file = $derived(image_upload?.file)
	let local_image_url = $state<string>()
	$effect(() => {
		if (!image_file || typeof image_file === 'string') return
		const url = URL.createObjectURL(image_file)
		local_image_url = url
		return () => {
			URL.revokeObjectURL(url)
			local_image_url = undefined
		}
	})
	const item_image = $derived(
		image_entry?.value?.url ||
			(image_upload && typeof image_file === 'string'
				? `${self.instance?.baseURL}/api/files/${is_library_image ? 'library_uploads' : 'site_uploads'}/${image_upload.id}/${image_file}`
				: local_image_url)
	)
	let item_icon = $derived(get_icon(subfields))
	let item_title = $derived(get_title(subfields))
</script>

<div class="RepeaterFieldItem" data-entry-id={entry.id} id="repeater-{field.key}-{index}">
	<div class="repeater-item-container">
		<div class="item-options">
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
					<button type="button" title="Move {singular_label} item up" aria-label="Move {singular_label} item up" disabled={!can_move_up} onclick={() => onmove(-1)}>
						<Icon icon="ph:arrow-up-bold" />
					</button>
					<button type="button" title="Move {singular_label} item down" aria-label="Move {singular_label} item down" disabled={!can_move_down} onclick={() => onmove(1)}>
						<Icon icon="ph:arrow-down-bold" />
					</button>
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
							onchange={(values) => onchange({ [field.key]: { [index]: { value: null, subValues: values } } })}
							{ondelete}
						/>
					</div>
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
				&:disabled {
					opacity: 0.35;
					cursor: default;
				}
				&:hover:not(:disabled) {
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
