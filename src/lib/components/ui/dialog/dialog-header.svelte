<script lang="ts">
	import DialogTitle from './dialog-title.svelte'
	import type { HTMLAttributes } from 'svelte/elements'
	import type { WithElementRef } from 'bits-ui'
	import { Loader } from 'lucide-svelte'
	import Icon from '@iconify/svelte'
	import { cn } from '$lib/utils.js'
	import { Button } from '$lib/components/ui/button'
	import { mod_key_held } from '$lib/builder/stores/app/misc.js'

	let {
		ref = $bindable(null),
		class: className,
		children,
		title,
		icon,
		button,
		...restProps
	}: WithElementRef<
		HTMLAttributes<HTMLDivElement> & {
			title: string
			icon?: string
			button?: {
				label: string
				onclick: () => void
				disabled?: boolean
				loading?: boolean
				hint?: string
			}
		}
	> = $props()
</script>

<div bind:this={ref} class={cn('dialog-header grid grid-cols-3 items-center shrink-0 min-w-0', className)} {...restProps}>
	<div class="dialog-tools ml-6">
		{@render children?.()}
	</div>
	<DialogTitle class="dialog-heading min-w-0 text-center flex items-center justify-center gap-2">
		{#if icon}
			<Icon {icon} class="h-4 w-4" />
		{/if}
		<span class="truncate">{title}</span>
	</DialogTitle>
	{#if button?.label}
		<Button variant="default" onclick={button.onclick} disabled={button.disabled} class="justify-self-end inline-flex justify-center items-center relative">
			<span class:opacity-0={(button.hint && $mod_key_held) || button.loading}>
				{button.label}
			</span>
			{#if button.hint && $mod_key_held && !button.loading}
				<span class="absolute inset-0 flex items-center justify-center">
					{button.hint}
				</span>
			{/if}
			{#if button.loading}
				<div class="animate-spin absolute inset-0 flex items-center justify-center">
					<Loader />
				</div>
			{/if}
		</Button>
	{/if}
</div>

<style>
	@media (max-width: 640px) {
		.dialog-header { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
		.dialog-tools { grid-column: 1 / -1; grid-row: 2; margin-left: 0; }
		.dialog-tools:empty { display: none; }
		.dialog-header :global(.dialog-heading) { grid-column: 1; grid-row: 1; justify-content: flex-start; padding-left: 36px; font-size: 16px; }
		.dialog-header :global(.dialog-heading svg) { flex-shrink: 0; }
		.dialog-header :global(> button) { grid-column: 2; grid-row: 1; min-height: 40px; }
	}
</style>
