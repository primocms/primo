<script lang="ts">
	import type { WithElementRef } from 'bits-ui'
	import type { HTMLAttributes } from 'svelte/elements'
	import { cn } from '$lib/utils.js'

	let { ref = $bindable(null), class: className, children, ...restProps }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props()
</script>

<div bind:this={ref} class={cn('mt-2 flex flex-wrap justify-end gap-2 border-t pt-4', className)} {...restProps}>
	{@render children?.()}
</div>
