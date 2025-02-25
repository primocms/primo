<script>
	import { createEventDispatcher } from 'svelte'
	import _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	// import { toast } from '@zerodevx/svelte-toast';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { buttonVariants } from '$lib/components/ui/button'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {string} [label]
	 * @property {string} [icon]
	 * @property {'sm' | 'lg'} [size]
	 * @property {any} [options]
	 * @property {any} [dividers]
	 * @property {string} [placement]
	 * @property {string} [variant]
	 */

	/** @type {Props} */
	let { label = '', icon = 'carbon:overflow-menu-vertical', options = [], dividers = [], placement = 'bottom-start', size = 'sm' } = $props()
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class={buttonVariants({ variant: 'ghost', size, class: 'p-1 rounded-md' })}>
		{#if label}
			<Icon {icon} />
			<p>{label}</p>
			<span class="dropdown-icon">
				<Icon icon="mi:select" />
			</span>
		{:else}
			<Icon {icon} />
		{/if}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="text-sm bg-[#171717] border-[#292929] border-[1px] z-[999999999]">
		<DropdownMenu.Group>
			<div class="options">
				{#each options as option, i}
					<DropdownMenu.Item
						class="p-1 cursor-pointer rounded"
						onSelect={(e) => {
							if (option.on_click) {
								option.on_click(e)
							} else {
								dispatch('input', option.value)
							}
						}}
					>
						<div class="flex items-center gap-2">
							<Icon icon={option.icon} />
							<span>{option.label}</span>
						</div>
					</DropdownMenu.Item>
					{#if dividers.includes(i)}
						<DropdownMenu.Separator />
					{/if}
				{/each}
			</div>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
