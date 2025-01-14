<script module>
	let Editor, Extension
	import('@tiptap/core').then((module) => {
		Editor = module.Editor
		Extension = module.Extension
	})
</script>

<script>
	import { onMount } from 'svelte'
	import _ from 'lodash-es'
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'
	import Typography from '@tiptap/extension-typography'
	import StarterKit from '@tiptap/starter-kit'
	import Image from '@tiptap/extension-image'
	import Youtube from '@tiptap/extension-youtube'
	import Highlight from '@tiptap/extension-highlight'
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
	import Link from '@tiptap/extension-link'
	import { all, createLowlight } from 'lowlight'
	import { tick, createEventDispatcher } from 'svelte'
	import { browser } from '$app/environment'
	import { createUniqueID } from '$lib/builder/utils'
	import { processCode, convert_html_to_markdown, compare_urls } from '$lib/builder/utils'
	import { hovering_outside } from '$lib/builder/utilities'
	import { locale } from '$lib/builder/stores/app/misc'
	import { site_html } from '$lib/builder/stores/app/page'
	import { update_section_entries } from '$lib/builder/actions/sections'
	import active_page from '$lib/builder/stores/data/page'
	import site from '$lib/builder/stores/data/site'
	import MarkdownButton from './MarkdownButton.svelte'
	import modal from '$lib/builder/stores/app/modal'
	import { get_content_with_synced_values } from '$lib/builder/stores/helpers'
	import { broadcastChanged } from '$lib/builder/database'
	import { component_iframe_srcdoc } from '$lib/builder/components/misc'

	const lowlight = createLowlight(all)

	const dispatch = createEventDispatcher()

	let { block, section } = $props()

	let node = $state()

	let component_data = $derived(
		get_content_with_synced_values({
			entries: section.entries,
			fields: block.fields,
			page: $active_page,
			site: $site
		})[$locale]
	)

	// let local_component_data
	async function save_edited_value({ id, key = null, value }) {
		// set local_component_data to avoid hydrating data when already changed on page
		// if (key) {
		// 	_.set(local_component_data, key, value)
		// }
		await update_section_entries({ id, value })
		broadcastChanged({ block_id: section.id })
	}

	let floating_menu = $state()
	let bubble_menu = $state()
	let image_editor = $state()
	let image_editor_is_visible = $state(false)

	let link_editor = $state()
	let link_editor_is_visible = $state(false)

	let active_editor = $state()

	let error = $state('')

	let generated_js = $state('')
	async function generate_component_code(code) {
		const res = await processCode({
			component: {
				head: '',
				html: code.html,
				css: code.css,
				js: code.js,
				data: _.cloneDeep(component_data)
			},
			buildStatic: false,
			hydrated: true
		})
		if (res.error) {
			error = res.error
			dispatch_mount()
		} else {
			error = ''
			generated_js = res.js
		}
	}

	let scrolling = false

	const markdown_classes = {}
	async function make_content_editable() {
		if (!node?.contentDocument) return

		const doc = node.contentDocument
		const valid_elements = Array.from(doc.querySelectorAll(`img, a, p, span, h1, h2, h3, h4, h5, h6, div`)).filter((element) => {
			const [child_node] = Array.from(element.childNodes).filter((node) => {
				const has_text = node?.nodeName === '#text' && node.nodeValue.trim().length > 0
				return has_text
			})

			const html = element?.innerHTML?.trim() || ''

			if (html || child_node || element.tagName === 'IMG' || element.tagName === 'A') {
				return true
			}
		})

		// loop over component_data and match to elements
		const assigned_entry_ids = new Set() // elements that have been matched to a field ID

		const static_field_types = ['text', 'link', 'image', 'markdown']
		const static_fields = block.fields.filter((f) => static_field_types.includes(f.type))

		for (const field of static_fields) {
			const relevant_entries = section.entries.filter((e) => e.field === field.id)

			for (const entry of relevant_entries) {
				if (!entry) {
					continue
				}
				search_elements_for_value({
					id: entry.id,
					key: field.key,
					value: entry.value,
					type: field.type
				})
			}
		}

		function search_elements_for_value({ id, key, value, type }) {
			for (const element of valid_elements) {
				if (element.dataset['entry']) continue // element is already tagged, skip

				const matched = match_value_to_element({
					id,
					key,
					value,
					type,
					element
				})
				if (matched) {
					assigned_entry_ids.add(id)
					break
				}
			}
		}

		function match_value_to_element({ id, element, key, value, type }) {
			// if (value === '' || !value) return false

			// ignore element
			if (element.dataset.key === '') {
				return false
			}

			// Match by explicitly set key
			const key_matches = element.dataset.key === key
			if (key_matches) {
				if (type === 'markdown') {
					set_editable_markdown({ element, key, id })
				} else if (type === 'image') {
					set_editable_image({ element, id })
				} else if (type === 'link') {
					set_editable_link({ element, id, url: value.url })
				} else {
					set_editable_text({ element, key, id })
				}
				return true
			}

			// Match by inferring key by type
			if (type === 'link' && element.nodeName === 'A') {
				const external_url_matches = value.url?.replace(/\/$/, '') === element.href?.replace(/\/$/, '')
				const internal_url_matches = window.location.origin + value.url?.replace(/\/$/, '') === element.href?.replace(/\/$/, '')
				const link_matches = (external_url_matches || internal_url_matches) && value.label === element.innerText

				if (link_matches) {
					set_editable_link({ element, id, key, url: value.url })
					return true
				}
			} else if (type === 'image' && element.nodeName === 'IMG') {
				const image_matches = compare_urls(value.url, element.src)
				if (image_matches) {
					set_editable_image({ element, id })
					return true
				}
			} else if (type === 'markdown' && element.nodeName === 'DIV') {
				const html = element.innerHTML?.trim()
				const html_matches = html === value.html
				if (html_matches && html.length > 0) {
					set_editable_markdown({ element, key, id })
					return true
				}
			} else if (type === 'text') {
				const text = element.innerText?.trim()
				const text_matches = typeof value == 'string' && value.trim() === text

				// All other field types are text
				if (text_matches && text.length > 0) {
					set_editable_text({ id, key, element })
					return true
				} else return false
			}
		}

		async function set_editable_markdown({ id, key, element }) {
			const html = element.innerHTML.trim()
			element.innerHTML = ''

			// move element classes to tiptap div
			const markdown_id = element.getAttribute('data-markdown-id') || createUniqueID()
			let saved_markdown_classes = markdown_classes[markdown_id]
			if (!saved_markdown_classes) {
				markdown_classes[markdown_id] = element.className
				saved_markdown_classes = markdown_classes[markdown_id]
				element.classList.remove(...element.classList)
				element.setAttribute('data-markdown-id', markdown_id) // necessary since data-markdown-id gets cleared when hydrating (i.e. editing from fields)
			}

			const editor = new Editor({
				content: html,
				element,
				extensions: [
					StarterKit,
					Image,
					Youtube.configure({
						modestBranding: true
					}),
					Typography,
					CodeBlockLowlight.configure({
						lowlight
					}),
					Link.configure({
						HTMLAttributes: {
							class: 'link'
						},
						openOnClick: false
					}),
					// TipTapImage.configure({}),
					Highlight.configure({ multicolor: false }),
					Extension.create({
						onFocus() {
							active_editor = editor
							dispatch('lock')
						},
						async onBlur() {
							dispatch('unlock')
							const updated_html = editor.getHTML()
							save_edited_value({
								id,
								key,
								value: {
									html: updated_html,
									markdown: await convert_html_to_markdown(updated_html)
								}
							})
						}
					})
				],
				editorProps: {
					attributes: {
						class: saved_markdown_classes,
						'data-markdown-id': markdown_id
					}
				}
			})
		}

		async function set_editable_image({ element, id }) {
			let rect
			element.setAttribute(`data-entry`, id)
			element.onmousemove = (e) => {
				if (!image_editor_is_visible) {
					attach_image_overlay(e)
				}
			}
			async function attach_image_overlay(e) {
				image_editor_is_visible = true
				await tick()
				const iframe_rect = node.getBoundingClientRect()
				rect = element.getBoundingClientRect()
				image_editor.style.left = `${rect.left + iframe_rect.left}px`
				image_editor.style.top = `${rect.top + iframe_rect.top}px`
				image_editor.style.width = `${rect.width}px`
				image_editor.style.height = `${rect.height}px`
				image_editor.style.borderRadius = getComputedStyle(element).borderRadius

				image_editor.onwheel = (e) => {
					image_editor_is_visible = false
				}

				image_editor.onmouseleave = (e) => {
					const is_outside = e.x >= Math.floor(rect.right) || e.y >= Math.floor(rect.bottom) || e.x <= Math.floor(rect.left) || e.y <= Math.floor(rect.top)
					if (is_outside) {
						image_editor_is_visible = false
					}
				}
				image_editor.onclick = () => {
					modal.show('DIALOG', {
						component: 'IMAGE',
						onSubmit: ({ url, alt }) => {
							element.src = url
							save_edited_value({ id, value: { url, alt } })
							image_editor_is_visible = false
							modal.hide()
						},
						props: {
							value: {
								url: element.src,
								alt: element.alt
							}
						}
					})
				}
			}
		}

		async function set_editable_link({ element, id, url }) {
			element.style.outline = '0'
			element.setAttribute(`data-entry`, id)
			element.contentEditable = true
			let updated_url = url
			let rect
			element.onkeydown = (e) => {
				if (e.code === 'Enter') {
					e.preventDefault()
					e.target.blur()
					link_editor_is_visible = false
					save_edited_value({
						id,
						value: {
							url: updated_url,
							label: element.innerText
						}
					})
				}
			}
			element.onclick = (e) => {
				e.preventDefault()
			}
			element.addEventListener('click', async () => {
				const iframe_rect = node.getBoundingClientRect()
				rect = element.getBoundingClientRect()

				link_editor_is_visible = true
				await tick()
				link_editor.style.left = `${rect.left + iframe_rect.left}px`
				link_editor.style.top = `${rect.top + rect.height + iframe_rect.top}px`

				const input = link_editor.querySelector('input')
				input.value = url

				const form = link_editor.querySelector('form')
				form.onsubmit = (e) => {
					e.preventDefault()
					element.href = input.value
					updated_url = input.value
					save_edited_value({
						id,
						value: {
							url: updated_url,
							label: element.innerText
						}
					})
					// set_editable_link({ element, key, url: updated_url })
					link_editor_is_visible = false
				}

				const button = link_editor.querySelector('button[data-link]')
				button.onclick = () => {
					window.open(element.href, '_blank')
				}
			})
		}

		async function set_editable_text({ id, key, element }) {
			element.style.outline = '0'
			element.setAttribute(`data-entry`, id)
			element.onkeydown = (e) => {
				if (e.code === 'Enter') {
					e.preventDefault()
					e.target.blur()
				}
			}
			element.onblur = (e) => {
				dispatch('unlock')
				save_edited_value({ id, key, value: e.target.innerText })
			}
			element.onfocus = () => {
				dispatch('lock')
			}
			element.contentEditable = true
		}
	}

	let mounted = false
	function dispatch_mount() {
		if (!mounted) {
			dispatch('mount')
			mounted = true
		}
	}

	// Reroute links to correctly open externally and internally
	async function reroute_links() {
		if (!node?.contentDocument) return
		const { pathname, origin } = window.location
		const [site] = pathname.split('/').slice(1)
		const site_url = `${origin}/${site}`
		node.contentDocument.querySelectorAll('a').forEach((link) => {
			link.onclick = (e) => {
				e.preventDefault()
			}

			// link internally
			if (window.location.host === link.host) {
				// TODO: restore, but use a 'link' button
				// link navigates to site home
				// if (link.pathname === '/') {
				// 	link.addEventListener('click', () => {
				// 		goto(`${site_url}/`)
				// 	})
				// 	return
				// }
				// const page_slugs = link.pathname.split('/').slice(1)
				// const page_path = page_slugs.join('/')
				// // Link to page
				// const page_exists = page_slugs.every((slug, i) => {
				// 	const parent_page_id = $pages.find((p) => p.slug === page_slugs[i - 1])?.id || null
				// 	return $pages.find((p) => p.slug === slug && p.parent === parent_page_id)
				// })
				// if (page_exists) {
				// 	link.addEventListener('click', () => {
				// 		goto(`${site_url}/${page_path}`)
				// 	})
				// } else {
				// 	// TODO: Create page
				// }
			} else {
				openLinkInNewWindow(link)
			}

			function openLinkInNewWindow(link) {
				if (link.dataset.key) return // is editable
				link.addEventListener('click', () => {
					window.open(link.href, '_blank')
				})
			}
		})
	}

	function on_page_scroll() {
		image_editor_is_visible = false
		link_editor_is_visible = false
		bubble_menu.style.display = 'none'
		floating_menu.style.display = 'none'
	}

	function on_hover_outside_image_editor(e) {
		if (hovering_outside(e, image_editor)) {
			image_editor_is_visible = false
		}
	}

	let compiled_code = $state(null)
	$effect(() => {
		if (!_.isEqual(compiled_code, block.code)) {
			generate_component_code(block.code)
			compiled_code = _.cloneDeep(block.code)
		}
	})

	let mutation_observer
	let resize_observer
	onMount(() => {
		mutation_observer = new MutationObserver(() => {
			dispatch_mount()
			reroute_links()
		})

		resize_observer = new ResizeObserver(() => {
			dispatch('resize')
		})

		// Resize component iframe wrapper on resize to match content height (message set from `setup_component_iframe`)
		window.addEventListener('message', (event) => {
			if (node && event.data?.type === 'resize') {
				if (event.data.id === section.id) {
					node.style.height = event.data.height + 'px'
				}
			}
		})

		// Hide Editor UI on scroll and hover outside
		window.addEventListener('scroll', on_page_scroll)
		window.addEventListener('mouseover', on_hover_outside_image_editor)

		return () => {
			mutation_observer?.disconnect()
			resize_observer?.disconnect()

			window.removeEventListener('scroll', on_page_scroll)
			window.removeEventListener('mouseover', on_hover_outside_image_editor)
		}
	})

	function update_menu_positions() {
		if (!node?.contentDocument || !floating_menu || !bubble_menu) return
		const iframe_rect = node.getBoundingClientRect()
		const selection = node.contentDocument.getSelection()

		if (selection?.rangeCount > 0) {
			const range = selection.getRangeAt(0)
			const hasSelection = selection.toString().length > 0

			// Bubble menu logic
			if (hasSelection) {
				const rect = range.getBoundingClientRect()
				bubble_menu.style.position = 'fixed'
				bubble_menu.style.left = `${rect.left + iframe_rect.left}px`
				bubble_menu.style.top = `${rect.bottom + iframe_rect.top + 10}px`
				bubble_menu.style.display = 'flex'
			} else {
				bubble_menu.style.display = 'none'
			}

			// Floating menu logic
			const startNode = range.startContainer
			const blockElement = startNode.nodeType === 3 ? startNode.parentElement : startNode
			const isTopLevelBlock = blockElement?.parentElement?.matches('.ProseMirror')
			const isEmptyParagraph = blockElement?.textContent === ''
			const isAtStart = range.startOffset === 0

			if (isEmptyParagraph && isAtStart && isTopLevelBlock) {
				const rect = blockElement.getBoundingClientRect()
				floating_menu.style.position = 'fixed'
				floating_menu.style.left = `${rect.left + iframe_rect.left + 10}px`
				floating_menu.style.top = `${rect.top + iframe_rect.top + 7}px`
				floating_menu.style.display = 'flex'
			} else {
				floating_menu.style.display = 'none'
			}
		}
	}

	let setup_complete = $state(false)
	function setup_component_iframe() {
		// Wait for iframe to be ready
		node.removeEventListener('load', setup)

		if (node.contentDocument.readyState === 'complete') {
			setup()
		} else {
			node.addEventListener('load', setup)
		}

		function setup() {
			const doc = node.contentDocument

			// Add resize handling
			const update_height = () => {
				const height = doc.body.clientHeight
				window.postMessage({ type: 'resize', height, id: section.id }, '*')
			}

			// Add resize observer
			const resize_observer = new ResizeObserver(update_height)
			resize_observer.observe(doc.body)

			// Add mutation observer for DOM changes
			mutation_observer.observe(doc.body, {
				childList: true,
				subtree: true,
				attributes: true,
				characterData: true
			})

			doc.addEventListener('mouseup', update_menu_positions)
			doc.addEventListener('keyup', update_menu_positions)

			setup_complete = true
		}
	}

	// mount or hydrate component
	$effect(() => {
		if (setup_complete) {
			send_component_to_iframe(generated_js, component_data)
		}
	})

	async function send_component_to_iframe(js, data) {
		try {
			node.contentWindow.postMessage({ type: 'component', payload: { js, data: _.cloneDeep(data) } }, '*')
			setTimeout(make_content_editable, 200) // wait for component to mount within iframe
		} catch (e) {
			console.error(e)
			error = e
			dispatch_mount()
		}
	}

	// Handle bubble and float menu positioning
	$effect(() => {
		const doc = node?.contentDocument
		if (doc) {
			const events = ['selectionchange', 'keyup', 'mouseup', 'touchend']

			const update = _.debounce(update_menu_positions, 50)
			events.forEach((event) => doc.addEventListener(event, update))

			return () => {
				events.forEach((event) => doc.removeEventListener(event, update))
			}
		}
	})
</script>

{#if image_editor_is_visible}
	<button style:pointer-events={scrolling ? 'none' : 'all'} in:fade={{ duration: 100 }} class="primo-reset image-editor" bind:this={image_editor}>
		<Icon icon="uil:image-upload" />
	</button>
{/if}

{#if link_editor_is_visible}
	<div in:fade={{ duration: 100 }} class="primo-reset link-editor" bind:this={link_editor}>
		<button onclick={() => (link_editor_is_visible = false)}>
			<Icon icon="ic:round-close" />
		</button>
		<button class="icon" data-link>
			<Icon icon="heroicons-solid:external-link" />
		</button>
		<form>
			<input type="text" />
		</form>
	</div>
{/if}

{#if $site_html && generated_js}
	<iframe
		frameborder="0"
		bind:this={node}
		title="block"
		srcdoc={component_iframe_srcdoc({
			head: $site_html
		})}
		onload={setup_component_iframe}
	></iframe>
{/if}

{#if error}
	<pre>
    {@html error}
  </pre>
{/if}

<div class="menu floating-menu primo-reset" bind:this={floating_menu} style="display:none">
	{#if active_editor}
		<MarkdownButton icon="fa-solid:heading" onclick={() => active_editor.chain().focus().toggleHeading({ level: 1 }).run()} />
		<MarkdownButton icon="fa-solid:code" onclick={() => active_editor.chain().focus().toggleCodeBlock().run()} />
		<MarkdownButton icon="fa-solid:quote-left" onclick={() => active_editor.chain().focus().toggleBlockquote().run()} />
		<MarkdownButton icon="fa-solid:list" onclick={() => active_editor.chain().focus().toggleBulletList().run()} />
		<MarkdownButton icon="fa-solid:list-ol" onclick={() => active_editor.chain().focus().toggleOrderedList().run()} />
		<MarkdownButton
			icon="fa-solid:image"
			onclick={() =>
				modal.show('DIALOG', {
					component: 'IMAGE',
					header: {
						icon: 'ic:twotone-image',
						title: 'Image'
					},
					onSubmit: ({ url, alt }) => {
						active_editor.chain().focus().setImage({ src: url, alt }).run()
						modal.hide()
					}
				})}
		/>
		<MarkdownButton
			icon="lucide:youtube"
			onclick={() =>
				modal.show('DIALOG', {
					header: {
						icon: 'mdi:youtube',
						title: 'Youtube Video Embed'
					},
					component: 'VIDEO',
					onSubmit: (url) => {
						if (url) {
							active_editor.commands.setYoutubeVideo({
								src: url,
								width: '100%'
							})
						}
						modal.hide()
					}
				})}
		/>
	{/if}
</div>
<div class="menu bubble-menu primo-reset" bind:this={bubble_menu} style="display:none">
	{#if active_editor}
		<MarkdownButton
			icon="fa-solid:link"
			onclick={() => {
				modal.show('DIALOG', {
					component: 'LINK',
					onSubmit: (val) => {
						active_editor.chain().focus().setLink({ href: val }).run()
						modal.hide()
					}
				})
			}}
		/>
		<MarkdownButton icon="fa-solid:bold" onclick={() => active_editor.chain().focus().toggleBold().run()} active={active_editor.isActive('bold')} />
		<MarkdownButton icon="fa-solid:italic" onclick={() => active_editor.chain().focus().toggleItalic().run()} active={active_editor.isActive('italic')} />
		<MarkdownButton icon="fa-solid:highlighter" onclick={() => active_editor.chain().focus().toggleHighlight().run()} active={active_editor.isActive('highlight')} />
	{/if}
</div>

<style lang="postcss">
	iframe {
		width: 100%;
	}
	pre {
		margin: 0;
		padding: 1rem;
		background: var(--primo-color-black);
		color: var(--color-gray-3);
		border: 1px solid var(--color-gray-6);
	}
	.menu {
		font-size: var(--font-size-1);
		display: flex;
		border-radius: var(--input-border-radius);
		/* margin-left: 0.5rem; */
		transition: opacity 0.1s;
		z-index: 999999 !important;
		box-shadow:
			0 0 #0000,
			0 0 #0000,
			0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}
	.bubble-menu {
		overflow: hidden;
		background-color: var(--color-gray-9);
		color: var(--primo-color-white);
		/* border-bottom-width: 2px; */
		border-color: var(--primo-color-brand);
	}
	.floating-menu {
		overflow: hidden;
		transform: translateY(-0.5rem);
		color: var(--color-gray-8);
		background-color: var(--primo-color-white);
	}
	.image-editor {
		position: fixed;
		font-size: 14px;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		border-bottom-right-radius: 4px;
		z-index: 99;
		transform-origin: top left;
		display: flex;
		justify-content: center;
		align-items: center;
		font-size: 2rem;
		overflow: visible;

		:global(svg) {
			height: clamp(0.5rem, 50%, 4rem);
			width: auto;
		}
	}

	.link-editor {
		position: fixed;
		font-size: 14px;
		background: rgba(0, 0, 0, 0.9);
		color: white;
		z-index: 999;
		display: flex;

		button {
			background: var(--color-gray-7);
			display: flex;
			align-items: center;
			padding: 0 5px;
			border-right: 1px solid var(--color-gray-6);
		}

		input {
			padding: 2px 5px;
			background: var(--color-gray-8);
			color: var(--color-gray-1);
			outline: 0;
		}
	}
</style>
