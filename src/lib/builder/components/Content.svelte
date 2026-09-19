<script lang="ts">
	import type { Field } from '$lib/common/models/Field'
	import type { Entity } from '$lib/Entity'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from './Fields/FieldsContent.svelte'
	import EntryContent from './Fields/EntryContent.svelte'
	import { current_user } from '$lib/pocketbase/user'
	import { read_only } from '$lib/pocketbase/author_mode'

	const {
		entity,
		fields,
		entries,
		oninput,
		ondelete
	}: {
		entity: Entity
		entries: Entry[]
		fields: Field[]
		oninput: FieldValueHandler
		ondelete: (entry_id: string) => void
	} = $props()

	function delete_entry_related_records(entry_id: string) {
		// Delete all sub-entries.
		for (const entry of entries) {
			if (entry.parent === entry_id) {
				delete_entry_related_records(entry.id)
				ondelete(entry.id)
			}
		}
	}

	function handle_delete_entry(entry_id: string) {
		delete_entry_related_records(entry_id)
		ondelete(entry_id)
	}

	// In Browse mode fields stay visible, selectable and copyable — only the
	// ability to change them goes away. Field types are pluggable (~20 of them,
	// each wrapping a different primitive), so rather than thread a `readonly`
	// prop through every one, mark the inputs read-only here once the subtree
	// has rendered. `readonly` (not `disabled`) keeps text selectable and
	// preserves contrast; checkboxes/radios/selects have no `readonly`, so
	// those get `disabled` plus a pointer-events guard on the wrapper.
	function apply_read_only(node: HTMLElement) {
		// Remember what each control looked like before we locked it, so leaving
		// Browse mode restores its own state rather than a guessed default.
		const originals = new WeakMap<HTMLElement, { readOnly?: boolean; disabled?: boolean; contenteditable: string | null }>()

		function lock() {
			for (const el of node.querySelectorAll<HTMLElement>('input, textarea, select, [contenteditable="true"]')) {
				if (!originals.has(el)) {
					originals.set(el, {
						readOnly: 'readOnly' in el ? (el as HTMLInputElement).readOnly : undefined,
						disabled: 'disabled' in el ? (el as HTMLInputElement).disabled : undefined,
						contenteditable: el.getAttribute('contenteditable')
					})
				}

				if (el instanceof HTMLInputElement) {
					if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'color' || el.type === 'range' || el.type === 'file') {
						el.disabled = true
					} else {
						el.readOnly = true
					}
				} else if (el instanceof HTMLTextAreaElement) {
					el.readOnly = true
				} else if (el instanceof HTMLSelectElement) {
					el.disabled = true
				} else {
					el.setAttribute('contenteditable', 'false')
				}
			}
		}

		function unlock() {
			// contenteditable="false" elements no longer match the lock selector,
			// so match both states when restoring.
			for (const el of node.querySelectorAll<HTMLElement>('input, textarea, select, [contenteditable]')) {
				const before = originals.get(el)
				if (!before) continue

				if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
					if (before.readOnly !== undefined) el.readOnly = before.readOnly
					if (before.disabled !== undefined) el.disabled = before.disabled
				} else if (el instanceof HTMLSelectElement) {
					if (before.disabled !== undefined) el.disabled = before.disabled
				} else if (before.contenteditable === null) {
					el.removeAttribute('contenteditable')
				} else {
					el.setAttribute('contenteditable', before.contenteditable)
				}

				originals.delete(el)
			}
		}

		function sync() {
			if ($read_only) lock()
			else unlock()
		}

		// Field subtrees mount lazily (repeaters, groups, conditional fields), so
		// re-apply whenever the rendered content changes — and whenever the mode
		// itself flips, since Content can stay mounted across that change.
		const observer = new MutationObserver(sync)
		observer.observe(node, { childList: true, subtree: true })
		const unsubscribe = read_only.subscribe(sync)

		return {
			destroy: () => {
				observer.disconnect()
				unsubscribe()
			}
		}
	}
</script>

<div class="Content" class:read-only={$read_only} use:apply_read_only>
	{#each fields.filter((f) => !f.parent || f.parent === '').sort((a, b) => (a.index || 0) - (b.index || 0)) as field (field.id)}
		<EntryContent {entity} {field} {fields} {entries} level={0} onchange={oninput} ondelete={handle_delete_entry} />
	{:else}
		<p class="empty-description">
			{#if $current_user?.siteRole === 'developer'}
				When you create fields, they'll be editable from here
			{:else}
				When the site developer creates fields, they'll be editable from here
			{/if}
		</p>
	{/each}
</div>

<style lang="postcss">
	.Content {
		width: 100%;
		display: grid;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
		/* padding-block: 0.5rem; */
		color: var(--color-gray-2);
		/* background: var(--primo-color-black); */
		height: 100%;
		overflow-y: auto;
		place-content: flex-start;
		justify-content: stretch;

		.empty-description {
			padding-inline: 0.5rem;
			color: var(--color-gray-4);
			font-size: var(--font-size-2);
			height: 100%;
			display: flex;
			align-items: flex-start;
			justify-content: center;
			margin-top: 12px;
		}
	}

	/* Browse mode: values stay legible and selectable (no dimming), but the
	   controls that would mutate them stop responding. Buttons inside a field
	   (image upload, icon picker, repeater add/remove) have no readonly
	   equivalent, so they're neutralised here. */
	.Content.read-only {
		:global(button:not([data-browse-allowed])),
		:global(select),
		:global(input[type='checkbox']),
		:global(input[type='radio']),
		:global(input[type='range']),
		:global(input[type='color']),
		:global(input[type='file']) {
			pointer-events: none;
		}

		/* Keep disabled controls at full contrast — they're being shown for
		   inspection, not signalling an error state. */
		:global(input:disabled),
		:global(select:disabled),
		:global(textarea:disabled) {
			opacity: 1;
			cursor: default;
		}

		:global(input[readonly]),
		:global(textarea[readonly]) {
			cursor: text;
		}
	}
</style>
