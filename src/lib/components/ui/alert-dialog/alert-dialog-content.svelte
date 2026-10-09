<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive, type WithoutChild } from 'bits-ui'
	import AlertDialogOverlay from './alert-dialog-overlay.svelte'
	import { cn } from '$lib/utils.js'

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		...restProps
	}: WithoutChild<AlertDialogPrimitive.ContentProps> & {
		portalProps?: AlertDialogPrimitive.PortalProps
	} = $props()
</script>

<AlertDialogPrimitive.Portal {...portalProps}>
	<AlertDialogOverlay />
	<AlertDialogPrimitive.Content
		bind:ref
		class={cn(
			'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed left-[50%] top-[50%] z-[1001] grid w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200 rounded-lg',
			className
		)}
		{...restProps}
	/>
</AlertDialogPrimitive.Portal>
