<script>
	import Icon from '@iconify/svelte'
	import { fade } from 'svelte/transition'
	import { isEqual, cloneDeep } from 'lodash-es'
	import { hide } from '$lib/components/Modal.svelte'
	import active_site from '$lib/builder/actions/active_site'
	import { pages } from '$lib/builder/stores/data'
	import ModalHeader from '$lib/components/ModalHeader.svelte'
	import { storageChanged } from '$lib/builder/database'
	import { site } from '$lib/builder/stores/data'
	import UI from '$lib/builder/ui'

	// @ts-ignore
	let local_site = $state(cloneDeep($site))
	let local_pages = $state(cloneDeep($pages))

	// TODO:
	// fields for title, description, etc
	// fields for social graph stuff

	function update_preview(site_or_page) {
		// console.log({ page_id, props })
		currently_editing = cloneDeep(site_or_page)
	}

	async function upload_image(page_id, target) {
		const image = target.files[0]
		const key = `${$site.id}/metadata/${page_id}/${image.name}`
		const { url } = await storageChanged({
			bucket: 'images',
			action: 'upload',
			key,
			file: image,
			options: {}
		})
		if (url) {
			local_pages = local_pages.map((page) =>
				page.id === page_id
					? {
							...page,
							metadata: {
								...page.metadata,
								image: url
							}
					  }
					: page
			)
		}
	}

	async function upload_default_image(target) {
		const image = target.files[0]
		const key = `${$site.id}/metadata/${image.name}`
		const { url } = await storageChanged({
			bucket: 'images',
			action: 'upload',
			key,
			file: image,
			options: {}
		})
		if (url) {
			local_site = {
				...local_site,
				metadata: {
					...local_site.metadata,
					image: url
				}
			}
		}
	}

	async function upload_favicon(target) {
		const image = target.files[0]
		const key = `${$site.id}/metadata/favicon--${image.name}`
		const res = await storageChanged({
			bucket: 'images',
			action: 'upload',
			key,
			file: image,
			options: {}
		})
		console.log({ res })
		// console.log({ url })
		// if (url) {
		// 	local_site = {
		// 		...local_site,
		// 		metadata: {
		// 			...local_site.metadata,
		// 			favicon: url
		// 		}
		// 	}
		// }
	}

	async function save_metadata() {
		// save changed pages metatadata
		const changed_pages = []
		for (let i = 0; i < local_pages.length; i++) {
			if (!isEqual(local_pages[i].metadata, $pages[i].metadata)) {
				changed_pages.push(local_pages[i])
			}
		}
		await Promise.all(
			changed_pages.map(async (page) => {
				await pages.update(page.id, { metadata: page.metadata })
			})
		)

		// save changed site metadata
		if (!isEqual(local_site.metadata, $site.metadata)) {
			await active_site.update({
				metadata: local_site.metadata
			})
		}
		hide()
		console.log('done', { changed_pages })
	}

	let currently_editing = $state(local_site)
</script>

<ModalHeader
	icon="octicon:info-16"
	title="Metadata"
	warn={() => {
		// if (!isEqual(local_component, component)) {
		//   const proceed = window.confirm(
		//     'Undrafted changes will be lost. Continue?'
		//   )
		//   return proceed
		// } else return true
		return true
	}}
	button={{
		icon: 'material-symbols:save',
		label: 'Save',
		onclick: save_metadata,
		disabled: false
	}}
/>
<main>
	<div style="flex:2;display: grid;gap: 0.5rem;overflow: auto;">
		<h3
			style="font-size: 0.875rem;
	font-weight: 500;"
		>
			Favicon
		</h3>
		<div style="display: grid; margin-bottom: 2rem;">
			<div class="thumbnail" style="width: 10rem; aspect-ratio: 1; border-radius: 0;">
				{#if local_site.metadata.favicon}
					<img class="og-image" src={local_site.metadata.favicon} alt="og" />
				{:else}
					<span style="pointer-events: none">
						<Icon icon="bx:image" />
					</span>
					<label
						aria-label="Add image"
						style="position: absolute;
				inset: 0;
				cursor: pointer;"
					>
						<input style="display:none" type="file" accept="image/*" onchange={({ target }) => upload_favicon(target)} />
					</label>
				{/if}
			</div>
		</div>

		<h3
			style="font-size: 0.875rem;
    font-weight: 500;"
		>
			Page Defaults
		</h3>
		<div style="display: grid; margin-bottom: 2rem;">
			{#if currently_editing.id === local_site.id}
				<div
					in:fade={{ duration: 100 }}
					class="container"
					style="display: flex;
	flex-wrap: wrap;
	gap: 1rem;"
				>
					<div class="thumbnail">
						{#if local_site.metadata.image}
							<img class="og-image" src={local_site.metadata.image} alt="og" />
						{:else if local_site.metadata.image}
							<img class="og-image" style="opacity: 0.25" src={local_site.metadata.image} alt="og" />
						{:else}
							<span style="pointer-events: none">
								<Icon icon="bx:image" />
							</span>
							<label
								aria-label="Add image"
								style="position: absolute;
				inset: 0;
				cursor: pointer;"
							>
								<input style="display:none" type="file" accept="image/*" onchange={({ target }) => upload_default_image(target)} />
							</label>
						{/if}
					</div>
					<div class="details">
						<h3 style="font-weight: 600">{local_site.name}</h3>
						<!-- <UI.TextInput label="Site Name" bind:value={local_site.metadata.name} on:input={() => update_preview(local_site)} /> -->
						<UI.TextInput label="Title" bind:value={local_site.metadata.title} on:input={() => update_preview(local_site)} />
						<UI.TextInput label="Description" placeholder={local_site.metadata.description} bind:value={local_site.metadata.description} on:input={() => update_preview(local_site)} />
					</div>
				</div>
			{:else}
				<div class="container og-preview">
					<figure class="thumbnail" style="cursor: initial;">
						{#if local_site.metadata.image}
							<img class="og-image" src={local_site.metadata.image} alt="og" />
						{:else if local_site.metadata.image}
							<img class="og-image" style="opacity: 0.25" src={local_site.metadata.image} alt="og" />
						{:else}
							<span style="pointer-events: none">
								<Icon icon="bx:image" />
							</span>
						{/if}
					</figure>
					<div style="display: grid;">
						<!-- <span style="font-weight:600">{local_site.name}</span> -->
						<span style="font-weight: 600;">{local_site.metadata.title}</span>
						<span class="description">
							{local_site.metadata.description}
						</span>
						<button style="text-decoration:underline;justify-self: flex-start;" onclick={() => (currently_editing = local_site)}>edit</button>
					</div>
				</div>
			{/if}
		</div>

		<h3
			style="font-size: 0.875rem;
	font-weight: 500;"
		>
			Pages
		</h3>
		<div style="display: grid;padding-bottom: 1rem;">
			{#each local_pages as page}
				{#if currently_editing.id === page.id}
					<div
						in:fade={{ duration: 100 }}
						class="container"
						style="display: flex;
				flex-wrap: wrap;
				gap: 1rem;"
					>
						<div class="thumbnail">
							{#if page.metadata.image || local_site.metadata.image}
								<img class="og-image" src={page.metadata.image || local_site.metadata.image} alt="og" />
							{:else}
								<span style="pointer-events: none">
									<Icon icon="bx:image" />
								</span>
								<label
									aria-label="Add image"
									style="position: absolute;
							inset: 0;
							cursor: pointer;"
								>
									<input style="display:none" type="file" accept="image/*" onchange={({ target }) => upload_image(page.id, target)} />
								</label>
							{/if}
						</div>
						<div class="details">
							<h3 style="font-weight: 600">{page.name}</h3>
							<UI.TextInput label="Title" placeholder={local_site.metadata.title} bind:value={page.metadata.title} on:input={() => update_preview(page)} />
							<UI.TextInput label="Description" placeholder={local_site.metadata.description} bind:value={page.metadata.description} on:input={() => update_preview(page)} />
						</div>
					</div>
				{:else}
					<div class="container og-preview">
						<figure class="thumbnail" style="cursor: initial;">
							{#if page.metadata.image}
								<img class="og-image" src={page.metadata.image} alt="og" />
							{:else if local_site.metadata.image}
								<img class="og-image" style="opacity: 0.25" src={local_site.metadata.image} alt="og" />
							{:else}
								<span style="pointer-events: none">
									<Icon icon="bx:image" />
								</span>
							{/if}
						</figure>
						<div style="display: grid;">
							<span style="font-size:0.75rem;">{page.name}</span>
							<span style="font-weight: 600;">{page.metadata.title || local_site.metadata.title}</span>
							<span class="description">
								{page.metadata.description || local_site.metadata.description}
							</span>
							<button style="text-decoration:underline;justify-self: flex-start;" onclick={() => (currently_editing = page)}>edit</button>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
	<div
		style="flex:1; overflow: auto; background: var(--color-gray-1);
	color: var(--color-gray-9);
	padding: 1.5rem;"
	>
		<h2
			style="margin-bottom: 1rem;
    border-bottom: 1px solid var(--color-gray-2);
    padding-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;"
		>
			Social Media Share Previews
		</h2>

		<div class="og-container">
			<h3>
				<Icon icon="ic:baseline-facebook" />
				<span>Facebook</span>
			</h3>
			<div
				style="display:grid;
			color: black;background-color: rgb(242, 243, 245);"
			>
				<img style="object-fit: cover;border: 1px solid rgb(218, 221, 225); border-bottom: 0; aspect-ratio: 1.9;" src={currently_editing.metadata.image || local_site.metadata.image} alt="site og" />
				<div style="display:grid;padding: 10px 12px;background: rgb(242, 243, 245);border: 1px solid rgb(218, 221, 225);">
					<span
						style="font-size: 12px;
					text-transform: uppercase;
					color: rgb(96, 103, 112);"
					>
						{local_site.custom_domain || `${local_site.id}.breezly.site`}
					</span>
					<span
						style="font-size: 16px;
					font-weight: 600;
					color: rgb(29, 33, 41);"
					>
						{currently_editing.metadata.title}
					</span>
					<span
						style="color: rgb(96, 103, 112); font-size: 14px; height: 18px; overflow: hidden;     overflow: hidden;
						white-space: nowrap;
						text-overflow: ellipsis;"
					>
						{currently_editing.metadata.description}
					</span>
				</div>
			</div>
		</div>
		<!-- TWITTER -->
		<div class="og-container">
			<h3>
				<Icon icon="ri:twitter-x-fill" />
				<span>Twitter</span>
			</h3>
			<div style="position: relative;">
				<img
					src={currently_editing.metadata.image || local_site.metadata.image}
					alt="site og"
					style="border: 1px solid rgb(225, 232, 237);aspect-ratio: 1.9;    object-fit: cover;    border-radius: 13.7px"
				/>
				<div
					style="display:grid;    position: absolute;
				left: 8px;
				bottom: 8px;"
				>
					<span
						style="border-radius: 4px;
					background: rgba(0, 0, 0, 0.4);
					color: rgb(255, 255, 255);
					padding: 2px 4px;
					font-size: 12px;"
					>
						{local_site.custom_domain || `${local_site.id}.breezly.site`}
					</span>
				</div>
			</div>
		</div>

		<div class="og-container">
			<h3>
				<Icon icon="mdi:linkedin" />
				<span>Linkedin</span>
			</h3>
			<div style="display:grid; box-shadow: rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px;">
				<img src={currently_editing.metadata.image || local_site.metadata.image} alt="site og" />
				<div style="display:grid;padding:1rem 0.5rem;padding: 10px; ">
					<span
						style="padding-bottom: 2px;
					font-size: 16px;
					font-weight: 600;
					line-height: 24px;
					color: #000000e6;"
					>
						{currently_editing.metadata.title}
					</span>
					<span
						style="    font-size: 12px;
					color: rgba(0, 0, 0, 0.6);
					text-transform: uppercase;"
					>
						{local_site.custom_domain || `${local_site.id}.breezly.site`}
					</span>
				</div>
			</div>
		</div>

		<!-- <div class="og-container">
			<h3>
				<Icon icon="ic:baseline-discord" />
				<span>Discord</span>
			</h3>
			<div style="display:grid;background: rgb(47, 49, 54); color: white;">
				<div style="display:grid;padding:1rem 0.5rem;">
					<span style="font-size: 12px;">{currently_editing.metadata.title}</span>
					<span style="font-size: 14px;">{currently_editing.metadata.description}</span>
					<img src={currently_editing.metadata.image || local_site.metadata.image} alt="site og" />
				</div>
			</div>
		</div> -->
	</div>
</main>

<style lang="postcss">
	main {
		display: flex; /* to help w/ positioning child items in code view */
		background: var(--primo-color-black);
		color: var(--color-gray-2);
		padding: 0 0.5rem;
		flex: 1;
		gap: 1rem;
		overflow: hidden;
		width: 100%;
	}
	.container {
		display: grid;
		padding: 1rem;
		border: 1px solid #222;
		/* border-radius: 0.25rem; */
	}
	.og-preview {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid #222;

		&:not(:last-child) {
			border-bottom: 0;
		}

		/* border-radius: 0.25rem; */

		.description {
			color: var(--color-gray-3);
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}
	}
	.og-image {
		object-fit: cover;
		aspect-ratio: 1.9;
		width: 2rem;
		border-radius: 0.25rem;
	}
	.og-container {
		margin-bottom: 1rem;

		h3 {
			font-weight: 500;
			font-size: 0.75rem;
			margin-bottom: 0.25rem;
			display: flex;
			gap: 0.25rem;
			align-items: center;
		}
	}
	.details {
		flex: 1;
		display: grid;
		gap: 0.25rem;
	}
	.thumbnail {
		aspect-ratio: 1.9;
		display: flex;
		height: 100%;
		position: relative;
		border: 1px solid var(--color-gray-8);
		border-radius: var(--primo-border-radius);
		font-size: 3rem;
		align-items: center;
		justify-content: center;
		cursor: pointer;

		img {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
		}
	}
</style>
