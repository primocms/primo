<script lang="ts">
	import { fade } from 'svelte/transition'
	import UI from '../../../ui'
	import { Button } from '$lib/components/ui/button'
	import { Loader } from 'lucide-svelte'
	import { validate_url } from '../../../utilities'
	import { Page } from '$lib/common/models/Page'
	import { page } from '$app/state'
	import { Sites, PageTypes, Pages } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { site_context } from '$lib/builder/stores/context'

	let { parent, oncreate }: { parent?: ObjectOf<typeof Pages>; oncreate: (new_page: Omit<Page, 'id' | 'parent' | 'site' | 'index'>) => void | Promise<void> } = $props()

	const { value: site } = site_context.get()
	const page_types = $derived(site?.page_types())

	// set page type equal to the last type used under this parent
	const default_page_type_id = $derived(parent?.children()?.[0]?.page_type ?? site?.page_types()?.[0]?.id ?? '')

	let new_page = $state<Omit<Page, 'id' | 'parent' | 'site' | 'index'>>({
		name: '',
		slug: '',
		page_type: ''
	})
	$effect.pre(() => {
		new_page = {
			name: '',
			slug: '',
			page_type: default_page_type_id
		}
	})

	let saving = $state(false)
	let error = $state('')

	let page_creation_disabled = $derived(!new_page.name.trim() || !new_page.slug || saving)

	let page_label_edited = $state(false)
	$effect(() => {
		new_page.slug = page_label_edited ? validate_url(new_page.slug) : validate_url(new_page.name)
	})
</script>

<form
	onsubmit={async (e) => {
		e.preventDefault()
		if (page_creation_disabled) return
		saving = true
		error = ''
		try {
			await oncreate(new_page)
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not create the page. Please try again.'
		} finally {
			saving = false
		}
	}}
	aria-busy={saving}
	in:fade={{ duration: 100 }}
	class:has-page-types={page_types && page_types.length > 1}
>
	<UI.TextInput autofocus={true} bind:value={new_page.name} id="page-label" label="Page name" disabled={saving} placeholder="About Us" />
	<UI.TextInput bind:value={new_page.slug} id="page-slug" label="Page slug" disabled={saving} oninput={() => (page_label_edited = true)} placeholder="about-us" />
	{#if page_types && page_types.length > 1}
		<UI.Select
			fullwidth={true}
			label="Page Type"
			value={new_page.page_type}
			options={page_types?.map((p) => ({ value: p.id, icon: p.icon, label: p.name }))}
			on:input={({ detail: page_type_id }) => (new_page.page_type = page_type_id)}
		/>
	{/if}
	<Button type="submit" disabled={page_creation_disabled}>
		{#if saving}<Loader class="animate-spin" aria-hidden="true" />{/if}{saving ? 'Creating…' : 'Create page'}
	</Button>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</form>

<style>
	form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		gap: 12px;
		padding: 16px;
		align-items: end;
		background: hsl(var(--muted) / 0.2);
		border-radius: 6px;
	}
	form.has-page-types {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto;
	}
	.error {
		grid-column: 1 / -1;
		color: #fca5a5;
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	@media (max-width: 700px) {
		form,
		form.has-page-types {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
