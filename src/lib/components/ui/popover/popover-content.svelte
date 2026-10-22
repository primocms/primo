<script lang="ts">
	import { cn } from '$lib/utils.js'
	import { Popover as PopoverPrimitive } from 'bits-ui'

	let {
		ref = $bindable(null),
		class: className,
		align = 'center',
		sideOffset = 4,
		portalProps,
		...restProps
	}: PopoverPrimitive.ContentProps & {
		portalProps?: PopoverPrimitive.PortalProps
	} = $props()
</script>

<PopoverPrimitive.Portal {...portalProps}>
	<PopoverPrimitive.Content
		bind:ref
		{align}
		{sideOffset}
		class={cn(
			'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[1100] w-72 max-w-[calc(100vw-2rem)] max-h-[var(--bits-popover-content-available-height)] overflow-y-auto text-sm rounded-lg border p-4 shadow-lg shadow-black/20 outline-hidden',
			className
		)}
		{...restProps}
	/>
</PopoverPrimitive.Portal>
