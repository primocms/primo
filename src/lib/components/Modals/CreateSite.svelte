<script>
	import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
	import Spinner from '$lib/ui/Spinner.svelte'
	import TextField from '$lib/ui/TextField.svelte'
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
	import { validate_url } from '$lib/utils'
	import { validate_site_structure_v2 } from '@primocms/builder'
	import Icon from '@iconify/svelte'
	import { buildStaticPage } from '@primocms/builder'
	import Themes from '../Themes.svelte'

	export let onSuccess = (newSite, preview) => {}

	let loading = false
	let finishing = false
	let site_name = ``
	let site_url = ``
	let selected_theme
	let siteIDFocused = false
	let message = ''
	$: canCreateSite = site_name && site_url && (selected_theme || duplicated_site)

	let duplicated_site = null
	let preview = '<div></div>'

	async function createSite() {
		finishing = true

		if (duplicated_site) {
			onSuccess(
				{
					...duplicated_site,
					site: {
						...duplicated_site.site,
						url: site_url,
						name: site_name
					}
				},
				preview
			)
		} else {
			const home_page = selected_theme.pages.find((page) => page.url === 'index')
			const preview = await buildStaticPage({
				page: home_page,
				site: selected_theme.site,
				page_sections: selected_theme.sections.filter((section) => section.page === home_page.id),
				page_symbols: selected_theme.symbols,
				no_js: true
			})
			onSuccess(
				{
					...selected_theme,
					site: {
						...selected_theme.site,
						url: site_url,
						name: site_name
					}
				},
				preview.html
			)
		}
	}

	function validateUrl() {
		site_url = validate_url(siteIDFocused ? site_url : site_name)
	}

	let duplicatingSite = false
	let primo_json_valid = true
	function readJsonFile({ target }) {
		loading = true
		duplicatingSite = true

		var reader = new window.FileReader()
		reader.onload = async function ({ target }) {
			if (typeof target.result !== 'string') return

			try {
				const uploaded = JSON.parse(target.result)
				const converted = validate_site_structure_v2(uploaded)
				if (converted) {
					duplicated_site = converted

					const home_page = duplicated_site.pages.find((page) => page.url === 'index')

					const page = await buildStaticPage({
						page: home_page,
						site: duplicated_site.site,
						page_sections: duplicated_site.sections.filter(
							(section) => section.page === home_page.id
						),
						page_symbols: duplicated_site.symbols,
						no_js: true
					})

					preview = page.html
				} else {
					primo_json_valid = false
				}
				loading = false
			} catch (e) {
				console.error({ e })
				primo_json_valid = false
			}
		}
		reader.readAsText(target.files[0])
	}
</script>

<main class="primo-reset primo-modal">
	{#if !finishing}
		<h1 class="primo-heading-xl">Create a site</h1>
		<form on:submit|preventDefault={createSite}>
			<div class="name-url">
				<TextField
					autofocus={true}
					label="Site Name"
					on:input={validateUrl}
					bind:value={site_name}
				/>
				<TextField
					label="Site URL"
					bind:value={site_url}
					on:input={validateUrl}
					on:focus={() => (siteIDFocused = true)}
				/>
			</div>
			{#if duplicatingSite && primo_json_valid}
				<div class="site-thumbnail">
					<SiteThumbnail {preview} />
				</div>
			{:else if duplicatingSite && !primo_json_valid}
				<div class="error">
					<p>Invalid Primo site file</p>
				</div>
			{:else}
				<Themes on:select={({ detail }) => (selected_theme = detail)} />
			{/if}
			<footer>
				<div id="upload-json">
					<label class="container">
						<input on:change={readJsonFile} type="file" id="primo-json" accept=".json" />
						<Icon icon="carbon:upload" />
						<span>Duplicate from primo.json</span>
					</label>
				</div>
			</footer>
			<div class="submit">
				<PrimaryButton
					type="submit"
					label={duplicatingSite ? 'Duplicate Site' : 'Create Site'}
					disabled={!canCreateSite && primo_json_valid}
					{loading}
				/>
			</div>
		</form>
	{:else}
		<div class="creating-site">
			<span>{duplicatingSite ? 'Duplicating' : 'Creating'} {site_name}</span>
			{#key message}
				<p>{message}</p>
			{/key}
			<Spinner />
		</div>
	{/if}
</main>

<style lang="postcss">
	.primo-modal {
		max-width: var(--primo-max-width-1);

		form {
			.name-url {
				margin-bottom: 1.5rem;
				margin-top: 0.5rem;
			}

			.submit {
				--color-link: var(--color-primored);
			}
		}
	}
	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		.container {
			margin-bottom: 1rem;
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}
		span {
			color: var(--color-gray-3);
			font-size: 0.75rem;
			text-decoration: underline;
		}
	}
	#upload-json {
		margin-bottom: 0.5rem;
		display: flex;
		justify-content: flex-start;

		label {
			cursor: pointer;

			input {
				display: none;
			}

			span {
				color: var(--color-gray-3);
				font-size: 0.75rem;
				text-decoration: underline;
			}
		}
	}

	.site-thumbnail {
		margin: 1rem 0;
		border-radius: 0.25rem;
		overflow: hidden;
		border: 1px solid var(--color-gray-8);
	}

	.error {
		padding: 1rem;
		background: #b00020;
		margin-bottom: 1rem;
	}

	.creating-site {
		display: flex;
		align-items: center;

		& > * {
			margin: 0 1rem;
		}
	}
</style>
