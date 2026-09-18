<script>
	import { onDestroy } from 'svelte'
	import Icon from '@iconify/svelte'
	import { get, set } from 'idb-keyval'
	import * as Avatar from '$lib/components/ui/avatar/index.js'

	/**
	 * @typedef {Object} Props
	 * @property {any} [id]
	 * @property {any} [title]
	 * @property {boolean} [minimal]
	 * @property {string} [icon]
	 * @property {any} [pill]
	 * @property {import('svelte').Snippet} [body]
	 * @property {import('svelte').Snippet} [children]
	 * @property {import('svelte').Snippet<[any]>} [footer]
	 */

	/** @type {Props} */
	let { id = null, title = null, minimal = false, icon = '', pill = null, body, children, footer } = $props()

	let hidden = $state(false)

	$effect.pre(() => {
		if (title)
			get(title).then((res) => {
				if (res !== undefined) {
					hidden = res
				}
			})
	})

	onDestroy(() => {
		if (title) {
			set(title, hidden)
		}
	})
</script>

<div class="Card" {id} class:minimal>
	<div>
		{#if title}
			<button
				class="header-button"
				data-browse-allowed
				onclick={() => {
					hidden = !hidden
				}}
			>
				<header>
					<div
						style="display: flex;
				align-items: center;
				gap: 0.5rem;"
					>
						{#if title}<span class="title">{title}</span>{/if}
						{#if icon}<Icon {icon} />{/if}
						{#if pill}
							<span class="pill">{pill}</span>
						{/if}
					</div>
					{#if hidden}
						<Icon icon="ph:caret-down-bold" />
					{:else}
						<Icon icon="ph:caret-up-bold" />
					{/if}
				</header>
			</button>
		{/if}
		{#if !hidden}
			<!-- <div class="card-body" transition:fade|local={{ duration: 100 }}> -->
			<div class="card-body">
				{@render body?.()}
				{@render children?.()}
			</div>
		{/if}
		{@render footer?.({ class: 'card-footer' })}
	</div>
</div>

<style lang="postcss">
	.Card {
		background: #1a1a1a;
		display: grid;
		position: relative; /* for absolutelty positioned button in top right corner */
	}
	button.header-button {
		padding: 1rem;
		&:not(:only-child) {
			border-bottom: 1px solid var(--color-gray-9);
		}
	}
	.Card.minimal .card-body {
		margin: 0 !important;
	}
	button {
		width: 100%;
		padding: 1rem;

		& + .card-body {
			padding-top: 0.5rem;
		}
	}

	header {
		width: 100%;
		font-size: var(--label-font-size);
		/* padding: 1rem; */
		/* font-weight: var(--label-font-weight); */
		font-weight: 400;
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		font-weight: 500;
		align-items: center;
		gap: 1rem;

		.title {
			font-weight: 400;
			text-align: left;
		}

		.pill {
			background: #b6b6b6;
			border-radius: 100px;
			padding: 3px 7px;
			font-size: 12px;
			font-weight: 500;
			color: #121212;
			margin-left: 0.5rem;
		}
	}
	.card-body {
		/* margin: 1.5rem; */
		margin: 1rem;
		overflow-x: hidden; /* for richtext field */
		overflow-x: initial; /* 'hidden' causes weird clipping */
		&:not(:only-child) {
			margin-top: 0;
		}
	}
</style>
