<script lang="ts">
	import Icon from '@iconify/svelte'
	import { validate_url } from '$lib/builder/utilities'
	import PageForm from './PageTypeForm.svelte'
	import MenuPopup from '$lib/builder/ui/Dropdown.svelte'
	import type { PageType } from '$lib/common/models/PageType'
	import { PageTypes, Pages } from '$lib/pocketbase/collections'
	import { self as pb, self } from '$lib/pocketbase/managers'
	import { page } from '$app/state'
	import * as AlertDialog from '$lib/components/ui/alert-dialog'
	import { Loader } from 'lucide-svelte'
	import { site_context } from '$lib/builder/stores/context'
	import * as Avatar from '$lib/components/ui/avatar/index.js'
	import { getUserActivity } from '$lib/UserActivity.svelte'

	let { active, page_type }: { active: boolean; page_type: PageType } = $props()

	const { value: site } = site_context.get()

	let editing_page_type = $state(false)
	let is_delete_open = $state(false)
	let deleting_page_type = $state(false)

	async function delete_page_type() {
		deleting_page_type = true
		try {
			if (!site) return

			// Delete all pages belonging to this page type (no cascade on pages.page_type)
			const pages = (await pb.instance?.collection('pages').getFullList({ filter: `page_type = \"${page_type.id}\" && site = \"${site.id}\"` })) ?? []

			for (const p of pages) {
				Pages.delete(p.id)
			}

			// Delete the page type (will cascade to related type records)
			PageTypes.delete(page_type.id)
			await self.commit()
			is_delete_open = false
		} catch (error) {
			console.error('Error deleting page type:', error)
		} finally {
			deleting_page_type = false
		}
	}

	let creating_page = $state(false)
	let new_page_url = $state('')
	$effect(() => {
		new_page_url = validate_url(new_page_url)
	})

	const full_url = $derived(() => {
		const base_path = page.url.pathname.includes('/sites/') ? `/admin/sites/${site?.id}` : '/admin/site'
		return `${base_path}/page-type--${page_type.id}`
	})
	const related_activities = $derived(getUserActivity({ filter: (activity) => activity.page_type?.id === page_type.id }))

	// Load pages that would be deleted when confirming
	const pages_to_delete = $derived(is_delete_open && site ? (Pages.list({ filter: { page_type: page_type.id, site: site.id }, sort: 'index' }) ?? undefined) : undefined)
</script>

{#if editing_page_type}
	<PageForm
		new_page_name={page_type.name}
		new_color={page_type.color}
		new_icon={page_type.icon}
		on:create={({ detail: modified_page }) => {
			editing_page_type = false
			PageTypes.update(page_type.id, modified_page)
			self.commit()
		}}
	/>
{:else}
	<div class="Item">
		<span class="icon" style:background={page_type.color}>
			<Icon icon={page_type.icon} />
		</span>
		<div class="page-item-container" class:active>
			<div class="left">
				<a class="name" href={full_url()}>
					{page_type.name}
				</a>
				<div class="flex -space-x-4">
					{#each related_activities as [{ user, user_avatar }]}
						<Avatar.Root class="ring-background ring-2 size-5 ml-4">
							{#if user_avatar}
								<Avatar.Image src={user_avatar} alt={user.name || user.email} class="object-cover object-center" />
							{/if}
							<Avatar.Fallback>{(user.name || user.email).slice(0, 2).toUpperCase()}</Avatar.Fallback>
						</Avatar.Root>
					{/each}
				</div>
			</div>
			<div class="options">
				<MenuPopup
					icon="carbon:overflow-menu-vertical"
					options={[
						{
							label: 'Edit Page Type',
							icon: 'clarity:edit-solid',
							on_click: () => {
								editing_page_type = !editing_page_type
							}
						},
						...(page_type.name !== 'Default'
							? [
									{
										label: 'Delete Type & Pages',
										icon: 'fluent:delete-20-filled',
										on_click: () => {
											is_delete_open = true
										}
									}
								]
							: [])
					]}
				/>
			</div>
		</div>
	</div>
{/if}

<AlertDialog.Root bind:open={is_delete_open}>
	<AlertDialog.Content class="z-[1001]">
		<AlertDialog.Header>
			<AlertDialog.Title>Delete page type?</AlertDialog.Title>
			<AlertDialog.Description>
				This action permanently deletes <strong>{page_type.name}</strong>
				and all its pages.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<div class="mt-2 space-y-2">
			<div class="text-sm text-muted-foreground">Pages to be deleted ({pages_to_delete ? pages_to_delete.length : '…'}):</div>
			{#if pages_to_delete === undefined}
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader class="animate-spin h-4 w-4" />
					Loading pages…
				</div>
			{:else if pages_to_delete.length === 0}
				<div class="text-sm text-muted-foreground">No pages use this type.</div>
			{:else}
				<div class="max-h-56 overflow-auto rounded border border-border/50">
					<ul class="divide-y divide-border/50 text-sm">
						{#each pages_to_delete as p}
							<li class="px-3 py-2 flex items-center justify-between gap-2">
								<span class="truncate">{p.name}</span>
								{#if p.slug}
									<code class="text-xs text-muted-foreground">/{p.slug}</code>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={delete_page_type} class="bg-red-600 hover:bg-red-700">
				{#if deleting_page_type}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Delete {page_type.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

{#if creating_page}
	<div style="border-left: 0.5rem solid #111;">
		<PageForm
			on:create={({ detail: page }) => {
				if (!site) return
				creating_page = false
				PageTypes.create(page)
				self.commit()
				// TODO: test & configure navigating to new page type
				// site.data.page_types.push(page)
				// const [created_page_type] = site.data.page_types.slice(-1)
				// goto(`/${site.id}/page-type--${created_page_type.id}`)
			}}
		/>
	</div>
{/if}

<style lang="postcss">
	.Item {
		display: grid;
		grid-template-columns: auto 1fr;
		border-radius: var(--primo-border-radius);
		overflow: hidden;
	}
	.icon {
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		padding-inline: 1rem;
	}
	.page-item-container {
		flex: 1;
		display: flex;
		justify-content: space-between;
		padding: 0.875rem 1.125rem;
		background: #1a1a1a;
		/* border-top-left-radius: 0;
		border-bottom-left-radius: 0; */

		&.active a {
			color: var(--primo-primary-color);
			/* outline: 1px solid var(--primo-primary-color); */
		}

		.options {
			display: flex;
			gap: 0.75rem;
		}
	}

	.left {
		display: flex;
		align-items: center;
		gap: 0.75rem;

		a.name {
			border-bottom: 1px solid transparent;
			margin-bottom: -1px;
			transition: 0.1s;
			&:hover {
				border-color: white;
			}
		}

		.name {
			font-weight: 400;
			line-height: 1.5rem;
			display: flex;
			gap: 1rem;
			color: var(--color-gray-1);
		}
	}
</style>
