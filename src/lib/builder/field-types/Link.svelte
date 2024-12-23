<script>
	import _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import UI from '../ui'
	import pages from '../stores/data/pages'
	import { locale } from '../stores/app'
	import { createEventDispatcher } from 'svelte'
	const dispatch = createEventDispatcher()

	const default_value = {
		label: '',
		url: '',
		active: false
	}

	let { field, value = $bindable(), metadata, oninput, children } = $props()

	if (!value || typeof value === 'string' || !value.label) {
		value = _.cloneDeep(default_value)
	}

	let selected = $state(urlMatchesPage(value.url))

	function urlMatchesPage(url) {
		if (url && url.startsWith('/')) {
			return 'page'
		} else {
			return 'url'
		}
	}

	let selected_page = $derived(metadata?.page_id ? $pages.find((p) => p.id === metadata.page_id) || $pages[0] : $pages[0])
	function get_page_url(page) {
		const prefix = $locale === 'en' ? '/' : `/${$locale}/`
		if (page.slug === '') {
			return prefix
		} else {
			let parent_urls = []
			if (page.parent) {
				let no_more_parents = false
				let grandparent = $pages.find((p) => p.id === page.parent)
				parent_urls.push(grandparent.slug)
				while (!no_more_parents) {
					grandparent = $pages.find((p) => p.id === grandparent.parent)
					if (!grandparent) {
						no_more_parents = true
					} else {
						parent_urls.unshift(grandparent.slug)
					}
				}
			}
			return parent_urls.length ? prefix + parent_urls.join('/') + '/' + page.slug : prefix + page.slug
		}
	}

	function dispatch_update({ label = value.label, url = value.url }, page_id = selected_page.id) {
		oninput({ value: { label, url }, metadata: { page_id } })
	}

	// auto-set link from page name
	let page_name_edited = $state(!!value.label)
</script>

<div class="Link">
	<div class="inputs">
		<UI.TextInput
			label={field.label}
			oninput={(text) => {
				page_name_edited = true
				dispatch_update({
					label: text
				})
			}}
			value={value.label}
			id="page-label"
			placeholder="About Us"
		/>
		<div class="url-select">
			<div class="toggle">
				<button class:active={selected === 'page'} onclick={() => (selected = 'page')}>
					<Icon icon="iconoir:multiple-pages" />
					<span>Page</span>
				</button>
				<button class:active={selected === 'url'} onclick={() => (selected = 'url')}>
					<Icon icon="akar-icons:link-chain" />
					<span>URL</span>
				</button>
			</div>
			{#if selected === 'page'}
				{@const top_level_pages = $pages.filter((p) => !p.parent)}
				<UI.Select
					value={selected_page.id}
					options={top_level_pages.map((page) => ({
						label: page.name,
						value: page.id,
						suboptions: $pages.filter((p) => p.parent === page.id).map((subpage) => ({ label: subpage.name, value: subpage.id }))
					}))}
					on:input={({ detail: page_id }) => {
						const page = $pages.find((p) => p.id === page_id)
						dispatch_update(
							{
								url: get_page_url(page),
								label: value.label || page.name // auto-set page name
							},
							page_id
						)
					}}
				/>
			{:else}
				<UI.TextInput
					oninput={(text) =>
						dispatch_update({
							url: text
						})}
					value={value.url}
					type="url"
					placeholder="https://primocms.org"
				/>
			{/if}
		</div>
	</div>
</div>
{@render children?.()}

<style lang="postcss">
	.Link {
		display: flex;
		flex-direction: column;
	}

	.toggle {
		display: flex;
		background: var(--color-gray-9);
		border: 1px solid var(--color-gray-8);
		padding: 2px;
		border-radius: var(--primo-border-radius);
		--Dropdown-font-size: 0.875rem;

		button {
			border-radius: var(--primo-border-radius);
			font-size: 0.875rem;
			flex: 1;
			background: var(--color-gray-8);
			color: #8a8c8e;
			padding: 0.25rem 0.5rem;
			font-weight: 500;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			transition: 0.1s;
			background: transparent;

			&:focus,
			&.active {
				color: white;
				background: var(--color-gray-8);
				/* z-index: 1; */
			}
		}
	}

	.inputs {
		display: grid;
		gap: 0.5rem;
		width: 100%;

		.url-select {
			display: flex;
			gap: 0.25rem;
			flex-wrap: wrap;
		}
	}
</style>
