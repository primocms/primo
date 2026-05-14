<script lang="ts" generics="T">
	import type { Snippet } from 'svelte'
	import { Skeleton } from '$lib/components/ui/skeleton'

	interface Props<T> {
		items: T[] | undefined
		loading?: boolean
		class?: string
		columnCount?: null | number
		skeletonCount?: number
		getKey?: (item: T) => string | number
		children: Snippet<[T]>
	}

	let { items, loading = false, class: className = '', columnCount = null, skeletonCount = 8, getKey = (item: any) => item?.id ?? item?.key ?? item, children }: Props<T> = $props()

	// Dynamically determine number of columns based on screen width
	let window_width = $state(typeof window !== 'undefined' ? window.innerWidth : 1200)

	$effect(() => {
		const handle_resize = () => {
			window_width = window.innerWidth
		}
		window.addEventListener('resize', handle_resize)
		return () => window.removeEventListener('resize', handle_resize)
	})

	const columns = $derived(columnCount ?? (window_width < 600 ? 1 : window_width < 700 ? 2 : window_width < 1200 ? 3 : 4))

	// Generate random ratios for skeleton cards
	const skeleton_ratios = $derived(Array.from({ length: columns }, () => Array.from({ length: Math.ceil(skeletonCount / columns) }, () => 0.5 + Math.random())))

	// Split items into columns for masonry layout
	const columnized_items = $derived(items ? Array.from({ length: columns }, (_, i) => items.filter((_, index) => index % columns === i)) : [])
</script>

<div class="masonry {className}" style:grid-template-columns="repeat({columns}, 1fr)">
	{#if loading || items === undefined}
		{#each skeleton_ratios as column_ratios}
			<ul>
				{#each column_ratios as ratio}
					<li>
						<Skeleton class="w-full" style="aspect-ratio: {ratio}" />
					</li>
				{/each}
			</ul>
		{/each}
	{:else}
		{#each columnized_items as column}
			<ul>
				{#each column as item (getKey(item))}
					<li>
						{@render children(item)}
					</li>
				{/each}
			</ul>
		{/each}
	{/if}
</div>

<style lang="postcss">
	.masonry {
		display: grid;
		gap: 1rem;
		overflow: auto;
		min-height: 0;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
