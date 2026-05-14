<script lang="ts">
	import * as _ from 'lodash-es'
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'
	import Toggle from 'svelte-toggle'
	import { Button } from '$lib/components/ui/button'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Input } from '$lib/components/ui/input'
	import MenuPopup from '../../ui/Dropdown.svelte'
	import { locale, mod_key_held } from '../../stores/app/misc'
	import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
	import IFrame from '../../components/IFrame.svelte'
	import { createEventDispatcher, onMount } from 'svelte'
	import { watch } from 'runed'
	import { block_html } from '$lib/builder/code_generators'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { SiteSymbols } from '$lib/pocketbase/collections'
	import { useExportSiteSymbol } from '$lib/workers/ExportSymbol.svelte'
	import { useContent } from '$lib/Content.svelte'
	import { Badge } from '$lib/components/ui/badge'
	import * as Tooltip from '$lib/components/ui/tooltip'
	import { page_context, page_type_context } from '$lib/builder/stores/context'
	import { PageTypes, PageTypeFields } from '$lib/pocketbase/collections'
	import { Unlink } from 'lucide-svelte'
	import * as Avatar from '$lib/components/ui/avatar/index.js'
	import { self } from '$lib/pocketbase/managers'
	import { getUserActivity } from '$lib/UserActivity.svelte'

	const dispatch = createEventDispatcher()

	let {
		symbol,
		controls_enabled = true,
		show_toggle = false,
		toggled = false,
		head = '',
		active_page_type_id = null
	}: {
		symbol: ObjectOf<typeof SiteSymbols>
		controls_enabled?: boolean
		show_toggle?: boolean
		toggled?: boolean
		head?: string
		active_page_type_id?: string | null
	} = $props()

	let name_el = $state()

	let renaming = $state(false)
	let new_name = $state(symbol.name)

	const related_activities = $derived(getUserActivity({ filter: ({ site_symbol }) => site_symbol?.id === symbol.id }))

	async function save_rename() {
		if (!symbol || !new_name.trim()) return

		try {
			SiteSymbols.update(symbol.id, { name: new_name.trim() })
			await self.commit()
			renaming = false
		} catch (error) {
			console.warn('Failed to rename symbol:', error)
		}
	}

	let height = $state(0)

	const _data = $derived(useContent(symbol, { target: 'cms' }))
	const data = $derived(_data && (_data[$locale] ?? {}))

	// Foreign Page Field chip: detect when this block references Page Fields
	// from a different page type than the active one (page or page type context)
	const { value: page_ctx } = page_context.getOr({ value: null })
	const { value: page_type_ctx } = page_type_context.getOr({ value: null })

	const active_page_type = $derived.by(() => {
		if (active_page_type_id) return PageTypes.one(active_page_type_id)
		if (page_type_ctx) return page_type_ctx
		if (page_ctx) return PageTypes.one(page_ctx.page_type)
		return null
	})

	const symbol_fields = $derived(symbol?.fields?.() ?? [])
	const foreign_page_types = $derived.by(() => {
		if (!active_page_type) return []
		const ids = new Set<string>()
		for (const f of symbol_fields) {
			if (f.type !== 'page-field') continue
			const target = f.config?.field ? PageTypeFields.one(f.config.field) : null
			if (!target) continue
			if (target.page_type && target.page_type !== active_page_type.id) {
				ids.add(target.page_type)
			}
		}
		return Array.from(ids)
	})
	const foreign_chip_title = $derived.by(() => {
		if (!foreign_page_types.length) return ''
		const names = foreign_page_types
			.map((id) => PageTypes.one(id))
			.filter(Boolean)
			.map((pt) => pt.name)
			.join(', ')
		return names ? `References Page Fields from ${names}.` : 'Uses Page Field(s) from another page type'
	})

	let componentCode = $state()
	let component_error = $state()
	let is_loading = $state(true)

	// Rebuild preview whenever code or data meaningfully change
	let last_signature = $state<any>()
	watch(
		() => ({ html: symbol.html, css: symbol.css, js: symbol.js, data }),
		({ html, css, js, data }) => {
			const signature = { html, css, js, data }
			if (_.isEqual(last_signature, signature) || !data) return
			last_signature = _.cloneDeep(signature)

			is_loading = true
			component_error = undefined
			try {
				const blockData = data || {}
				block_html({ code: { html, css, js }, data: blockData }).then((res) => {
					if (res && res.body) {
						componentCode = res
					}
				})
			} catch (error) {
				console.error('Sidebar symbol error for', symbol.name, ':', error)
				component_error = error
			} finally {
				is_loading = false
			}
		}
	)

	let element = $state()
	$effect(() => {
		if (element) {
			draggable({
				element,
				getInitialData: () => ({ block: symbol }),
				onDragStart: () => {
					if (typeof window !== 'undefined') {
						const detail = { block: symbol }
						window.dispatchEvent(new CustomEvent('primoDragStart', { detail }))
						// Backwards-compatible alias for external listeners
						window.dispatchEvent(new CustomEvent('palaDragStart', { detail }))
					}
				},
				onDrop: () => {
					if (typeof window !== 'undefined') {
						const detail = { block: symbol }
						window.dispatchEvent(new CustomEvent('primoDragEnd', { detail }))
						// Backwards-compatible alias for external listeners
						window.dispatchEvent(new CustomEvent('palaDragEnd', { detail }))
					}
				}
			})
		}
	})
	// move cursor to end of name
	$effect(() => {
		if (name_el) {
			const range = document.createRange()
			const sel = window.getSelection()
			range.setStart(name_el, 1)
			range.collapse(true)

			sel?.removeAllRanges()
			sel?.addRange(range)
		}
	})

	// Export symbol
	const exportSymbol = $derived(useExportSiteSymbol(symbol.id))
	async function export_symbol() {
		try {
			await exportSymbol.run()
		} catch (error) {
			console.error('Failed to export symbol:', error)
		}
	}
</script>

<Dialog.Root bind:open={renaming}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename Block</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your Block</p>
		<form
			onsubmit={(e) => {
				e.preventDefault()
				save_rename()
			}}
		>
			<Input bind:value={new_name} placeholder="Enter new Block name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (renaming = false)}>Cancel</Button>
				<Button type="submit">Rename</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<div class="sidebar-symbol">
	<header>
		<div class="name">
			<h3>{symbol.name}</h3>
			{#if foreign_page_types.length > 0}
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Badge variant={toggled ? 'destructive' : 'secondary'} class="ml-2">
								{#if toggled}
									<Unlink class="w-3 h-3" />
									<span class="ml-1">Foreign Page Field</span>
								{:else}
									<Unlink class="w-3 h-3" />
								{/if}
							</Badge>
						</Tooltip.Trigger>
						<Tooltip.Content side="top" align="start">{foreign_chip_title}</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			{/if}
			{#if controls_enabled}
				<!-- TODO: add popover w/ symbol info -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- <div
					class="info"
					title={active_symbol_label}
					on:mouseover={get_label}
					on:focus={get_label}
				>
					<Icon icon="mdi:info" />
				</div> -->
			{/if}
		</div>
		{#if controls_enabled}
			<div class="symbol-options">
				{#if $mod_key_held}
					<div class="overlay-actions">
						<button onclick={() => dispatch('edit')}>
							<Icon icon="material-symbols:code" />
						</button>
						<button onclick={() => export_symbol()}>
							<Icon icon="material-symbols:download" />
						</button>
						<button
							onclick={() => {
								new_name = symbol.name
								renaming = true
							}}
						>
							<Icon icon="material-symbols:edit" />
						</button>
						<button class="delete" onclick={() => dispatch('delete')}>
							<Icon icon="ic:outline-delete" />
						</button>
					</div>
				{:else}
					{#if show_toggle}
						<Toggle label="Toggle Symbol for Page Type" disabled={!!component_error} hideLabel={true} {toggled} small={true} on:toggle />
					{/if}
					<MenuPopup
						icon="carbon:overflow-menu-vertical"
						options={[
							{
								label: 'Edit',
								icon: 'material-symbols:code',
								on_click: () => {
									dispatch('edit')
								}
							},
							{
								label: 'Export',
								icon: 'material-symbols:download',
								on_click: () => {
									export_symbol()
								}
							},
							{
								label: 'Rename',
								icon: 'material-symbols:edit',
								on_click: () => {
									new_name = symbol.name
									renaming = true
								}
							},
							{
								label: 'Delete',
								icon: 'ic:outline-delete',
								on_click: () => {
									dispatch('delete')
								}
							}
						]}
					/>
				{/if}
			</div>
		{/if}
	</header>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="symbol-container" class:disabled={component_error} bind:this={element} data-test-id="symbol-{symbol.id}">
		{#if component_error}
			<div class="error">
				<!-- <Icon icon="heroicons:no-symbol-16-solid" /> -->
			</div>
		{:else if is_loading}
			<div class="loading">
				<Icon icon="eos-icons:three-dots-loading" />
			</div>
		{:else if componentCode}
			{#each related_activities as [activity]}
				<div transition:fade class="absolute z-10 bg-[#222] p-1 right-0 top-0 rounded-bl-lg flex justify-center -space-x-1">
					<Avatar.Root class="ring-background ring-2 size-5">
						{#if activity.user_avatar}
							<Avatar.Image src={activity.user_avatar} alt={activity.user.name || activity.user.email} class="object-cover object-center" />
						{/if}
						<Avatar.Fallback>{(activity.user.name || activity.user.email).slice(0, 2).toUpperCase()}</Avatar.Fallback>
					</Avatar.Root>
				</div>
			{/each}
			<div class="symbol">
				<IFrame bind:height {head} {componentCode} />
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.sidebar-symbol {
		--IconButton-opacity: 0;

		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding-bottom: 0.5rem;
			color: #e7e7e7;
			transition: opacity 0.1s;
			gap: 1rem;

			.name {
				overflow: hidden;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 13px;
				line-height: 16px;

				h3 {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
			}

			.symbol-options {
				display: flex;
				align-items: center;
				color: #e7e7e7;
				gap: 3px;

				:global(svg) {
					height: 1rem;
					width: 1rem;
				}

				.overlay-actions {
					display: flex;
					gap: 0.25rem;

					button {
						font-size: 15px;
						padding: 7px;
						border-radius: 0.25rem;
						transition: 0.1s;
						border: 1px solid transparent;
						outline: 0;

						&:hover {
							background: var(--color-gray-8);
						}

						&:focus-visible {
							border-color: var(--primo-primary-color);
							outline: 0;
						}
					}

					button.delete {
						color: var(--primo-color-danger);
						&:hover {
							color: white;
							background: var(--primo-color-danger);
						}
					}
				}
			}
		}
	}
	.symbol-container {
		width: 100%;
		position: relative;
		overflow: hidden;
		cursor: grab;
		min-height: 2rem;
		transition: box-shadow 0.2s;

		&:after {
			content: '';
			position: absolute;
			inset: 0;
		}

		&.disabled {
			pointer-events: none;
		}
	}
	.symbol {
		border-radius: 0.25rem;
		overflow: hidden;
	}
	.error {
		display: flex;
		justify-content: center;
		height: 100%;
		position: absolute;
		inset: 0;
		align-items: center;
		/* background: #ff0000; */
	}
	.loading {
		display: flex;
		justify-content: center;
		height: 100%;
		position: absolute;
		inset: 0;
		align-items: center;
		color: #888;

		:global(svg) {
			height: 1rem;
			width: 1rem;
		}
	}
</style>
