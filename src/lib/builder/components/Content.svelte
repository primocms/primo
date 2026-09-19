<script lang="ts">
	import type { Field } from '$lib/common/models/Field'
	import type { Entity } from '$lib/Entity'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from './Fields/FieldsContent.svelte'
	import EntryContent from './Fields/EntryContent.svelte'
	import { current_user } from '$lib/pocketbase/user'
	import { read_only } from '$lib/pocketbase/author_mode'
	import { apply_read_only } from '$lib/builder/utils/read_only_dom'

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
		if ($read_only) return
		delete_entry_related_records(entry_id)
		ondelete(entry_id)
	}

	// Consumers pass their own mutation callbacks (SiteEditor's write straight to
	// SiteEntries), so guard here rather than trusting each call site.
	function handle_input(...args: Parameters<FieldValueHandler>) {
		if ($read_only) return
		oninput(...args)
	}

</script>

<div class="Content" class:read-only={$read_only} use:apply_read_only>
	{#each fields.filter((f) => !f.parent || f.parent === '').sort((a, b) => (a.index || 0) - (b.index || 0)) as field (field.id)}
		<EntryContent {entity} {field} {fields} {entries} level={0} onchange={handle_input} ondelete={handle_delete_entry} />
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
		/* Controls are genuinely disabled by the action (so they can't be reached
		   by keyboard either) — keep them at full contrast, since they're being
		   shown for inspection rather than signalling an error state. */
		:global(input:disabled),
		:global(select:disabled),
		:global(textarea:disabled),
		:global(button:disabled) {
			opacity: 1;
			cursor: default;
		}

		:global(input[readonly]),
		:global(textarea[readonly]) {
			cursor: text;
		}
	}
</style>
