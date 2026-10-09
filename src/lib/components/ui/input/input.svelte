<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements'
	import type { WithElementRef } from 'bits-ui'
	import { cn } from '$lib/utils.ts'

	let { ref = $bindable(null), value = $bindable(), class: className, ...restProps }: WithElementRef<HTMLInputAttributes> = $props()
</script>

<input
	bind:this={ref}
	class={cn(
		'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-muted/20 px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-muted/20 file:text-sm file:font-medium focus-visible:outline-hidden focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
		className
	)}
	bind:value
	{...restProps}
/>
