<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui'
	import { cn } from '$lib/utils.ts'

	let { ref = $bindable(null), class: className, ...restProps }: DropdownMenuPrimitive.SubContentProps = $props()
</script>

<DropdownMenuPrimitive.SubContent
	bind:ref
	class={cn(
		'bg-popover text-popover-foreground z-[1100] min-w-[10rem] max-w-[calc(100vw-2rem)] max-h-[var(--bits-dropdown-menu-content-available-height)] overflow-y-auto rounded-lg border p-1 shadow-lg shadow-black/20 focus:outline-hidden',
		className
	)}
	{...restProps}
/>
