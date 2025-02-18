<script lang="ts">
	import DialogTitle from './dialog-title.svelte'
	import type { HTMLAttributes } from 'svelte/elements'
	import type { WithElementRef } from 'bits-ui'
	import { Loader } from 'lucide-svelte'
	import { cn } from '$lib/utils.js'
	import { Button } from '$lib/components/ui/button'

	let {
		ref = $bindable(null),
		class: className,
		children,
		title,
		button,
		...restProps
	}: WithElementRef<
		HTMLAttributes<HTMLDivElement> & {
			title: string
			button?: {
				label: string
				onclick: () => void
				disabled?: boolean
				loading?: boolean
			}
		}
	> = $props()
</script>

<div bind:this={ref} class={cn('grid grid-cols-3 items-center', className)} {...restProps}>
	<div class="ml-4">
		{@render children?.()}
	</div>
	<DialogTitle class="text-center">{title}</DialogTitle>
	{#if button?.label}
		<Button variant="default" onclick={button.onclick} disabled={button.disabled} class="justify-self-end inline-flex justify-center items-center">
			<span class:invisible={button.loading}>{button.label}</span>
			{#if button.loading}
				<div class="animate-spin absolute">
					<Loader />
				</div>
			{/if}
		</Button>
	{/if}
</div>
