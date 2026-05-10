<script>
	import { createEventDispatcher } from 'svelte'
	import * as _ from 'lodash-es'
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
	 * @property {1 | 2} [px]
	 * @property {any} [options]
	 * @property {any} [dividers]
	 * @property {string} [variant]
	 */

	/** @type {Props} */
	let { label = '', icon = 'carbon:overflow-menu-vertical', options = [], dividers = [], px = 1, size = 'sm' } = $props()
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={buttonVariants({ variant: 'ghost', size, class: `py-1 px-${px} rounded-md focus-visible:ring-1 focus-visible:ring-[var(--primo-primary-color)] focus-visible:outline-none` })}
	>
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
	<DropdownMenu.Content class="text-sm bg-[#171717] border-[#292929] border-[1px] z-999999999">
		<DropdownMenu.Group>
			<div class="options">
				{#each options as option, i}
					<DropdownMenu.Item
						class="p-1 rounded {option.danger ? 'text-[var(--primo-color-danger)]' : ''} {option.disabled ? 'text-gray-500 cursor-not-allowed' : 'cursor-pointer'}"
						disabled={option.disabled}
						onSelect={(e) => {
							if (option.disabled) return
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
