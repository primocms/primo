<script lang="ts">
	import { tick } from 'svelte'
	import { dropIndex } from '$lib/builder/stores/app/outline-order.js'
	import { ListTree, GripVertical, Lock, SquarePen } from 'lucide-svelte'
	import { outline, outlineSelection, outlineBusy } from '$lib/builder/stores/app/outline'
	let dragging = $state<string | null>(null)
	let dropAt = $state<number | null>(null)
	let list: HTMLDivElement
	const movable = $derived($outline?.rows.filter((r) => !r.shared) ?? [])
	$effect(() => {
		const id = $outlineSelection
		if (id) tick().then(() => list?.querySelector(`[data-outline-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }))
	})
</script>

<div class="page-outline" bind:this={list}>
	<div class="heading">
		<strong>{$outline?.pageName ?? 'Page'}</strong>
		<span>{$outline?.rows.length ?? 0} {$outline?.rows.length === 1 ? 'section' : 'sections'}</span>
	</div>
	{#each $outline?.rows ?? [] as row, rowIndex (row.id)}
		{#if rowIndex > 0 && $outline?.rows[rowIndex - 1].zone !== row.zone}<div class="zone-divider"></div>{/if}
		{@const index = movable.findIndex((r) => r.id === row.id)}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="row"
			class:selected={$outlineSelection === row.id}
			class:drop-before={dropAt === index && dragging !== null}
			class:drop-after={dropAt === index + 1 && dragging !== null && index === movable.length - 1}
			data-outline-id={row.id}
			title={row.shared ? 'Shared across pages of this page type. Position is controlled by the page template.' : !row.movable && $outline?.canEdit ? $outline.structureReason : undefined}
			ondragover={(event) => {
				if (dragging && row.movable) {
					event.preventDefault()
					dropAt = index + (event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 ? 1 : 0)
				}
			}}
			ondrop={(event) => {
				event.preventDefault()
				if (dragging && row.movable && dropAt !== null) {
					const target = dropIndex(
						movable.findIndex((r) => r.id === dragging),
						dropAt,
						movable.length
					)
					if (target !== null) $outline?.move(dragging, target)
				}
				dragging = null
				dropAt = null
			}}
		>
			<div class="row-main">
				{#if row.movable}
					<button
						class="drag"
						aria-label={`Drag ${row.name} to reorder`}
						draggable={!$outlineBusy}
						ondragstart={(event) => {
							dragging = row.id
							event.dataTransfer?.setData('text/plain', row.id)
						}}
						ondragend={() => {
							dragging = null
							dropAt = null
						}}
					>
						<GripVertical size={14} />
					</button>
				{:else}<Lock size={13} class="fixed-icon" />{/if}
				<button class="select" aria-pressed={$outlineSelection === row.id} onclick={() => $outline?.select(row.id, true)}>
					<span>{row.name}</span>
					{#if row.shared}<small title="Changes to this section apply to every page using this page type.">Shared</small>{/if}
				</button>
				<button class="edit-content" title={$outline?.canEdit ? 'Edit content' : 'View content'} aria-label={`${$outline?.canEdit ? 'Edit' : 'View'} ${row.name} content`} onclick={() => $outline?.edit(row.id)}>
					<SquarePen size={14} />
				</button>
			</div>
		</div>
	{/each}
	{#if !$outline?.rows.length}<div class="empty">
			<ListTree size={24} />
			<strong>Your page starts here</strong>
			<p>Drag a block from the Blocks tab onto the page.</p>
		</div>{/if}
	{#if $outline && !$outline.canEdit}<p class="hint">Read-only · Browse sections and content.</p>{:else if $outline && !$outline.canAdd}<p class="hint">
			This page’s structure is controlled by its template.
		</p>{/if}
</div>

<style>
	.page-outline {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: 400;
		color: #e4e4e7;
		font-size: 13px;
	}
	.heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		color: #a1a1aa;
		font-size: 12px;
		padding: 4px 8px 13px;
	}
	.heading strong { color: #e4e4e7; font-size: 13px; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.heading > span { flex-shrink: 0; }
	.zone-divider { height: 1px; background: #343437; margin: 5px 0; }
	.row {
		border: 1px solid transparent;
		border-radius: 5px;
		padding: 3px;
		position: relative;
	}
	.row:hover {
		background: #222225;
	}
	.row.selected {
		border-color: #956e51;
		background: #3a3027;
	}
	.row.drop-before:before {
		content: '';
		position: absolute;
		inset: -3px 0 auto;
		height: 2px;
		background: var(--primo-primary-color);
	}
	.row.drop-after:after {
		content: '';
		position: absolute;
		inset: auto 0 -3px;
		height: 2px;
		background: var(--primo-primary-color);
	}
	.row-main {
		display: flex;
		align-items: center;
		min-height: 33px;
		gap: 3px;
	}
	.select {
		font-weight: 400;
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		text-align: left;
		padding: 6px 4px;
	}
	.select span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	small {
		font-size: 11px;
		color: #a1a1aa;
	}
	.drag {
		padding: 5px;
		color: #73737b;
		cursor: grab;
	}
	.page-outline :global(.fixed-icon) {
		margin: 5px;
		color: #999;
	}
	.edit-content {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		border-radius: 4px;
		color: #aaa;
		opacity: 0;
		pointer-events: none;
	}
	.row:hover .edit-content,
	.row:focus-within .edit-content,
	.row.selected .edit-content {
		opacity: 1;
		pointer-events: auto;
	}
	.edit-content:hover {
		background: #ffffff12;
		color: #eee;
	}
	@media (hover: none) {
		.edit-content { opacity: 1; pointer-events: auto; }
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	button:focus-visible {
		outline: 2px solid var(--primo-primary-color);
		outline-offset: 2px;
	}
	p {
		font-size: 11px;
		color: #b6b2c2;
		line-height: 1.5;
		padding: 4px 7px;
	}
	.hint {
		text-align: center;
	}
	.empty {
		padding: 24px 10px;
		display: flex;
		align-items: center;
		flex-direction: column;
		gap: 10px;
	}
</style>
