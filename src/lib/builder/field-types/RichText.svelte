<script lang="ts">
	import { onMount } from 'svelte'
	import { fade } from 'svelte/transition'
	import { Editor } from '@tiptap/core'
	import { rich_text_extensions } from '$lib/builder/rich-text/extensions'
	import RichTextButton from '$lib/builder/views/editor/Layout/RichTextButton.svelte'
	import { loadIcons } from '@iconify/svelte'
	import type { Entity } from '$lib/Entity'
	import type { Field } from '$lib/common/models/Field'
	import type { Entry } from '$lib/common/models/Entry'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'
	import MenuPopup from '$lib/builder/ui/Dropdown.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Dialog from '$lib/components/ui/dialog'
	import VideoModal from '$lib/builder/views/modal/VideoModal.svelte'
	import LinkField from '$lib/builder/field-types/Link.svelte'
	import ImageField from '$lib/builder/field-types/ImageField.svelte'
	import ImageEditorOverlay from '$lib/builder/components/ImageEditorOverlay.svelte'
	import { Pages } from '$lib/pocketbase/collections'
	import { build_live_page_url } from '$lib/pages'
	import { createUniqueID } from '$lib/builder/utils'

	let {
		field,
		entry,
		onchange
	}: {
		entity: Entity
		field: Field
		entry?: Entry
		onchange: FieldValueHandler
	} = $props()

	// Preload all icons used in the dropdown to prevent layout shift
	loadIcons([
		'lucide:pilcrow',
		'lucide:heading-1',
		'lucide:heading-2',
		'lucide:heading-3',
		'lucide:list',
		'lucide:list-ordered',
		'lucide:quote',
		'lucide:code',
		'lucide:bold',
		'lucide:italic',
		'lucide:strikethrough',
		'lucide:highlighter',
		'lucide:link',
		'lucide:minus',
		'lucide:image',
		'lucide:youtube',
		'lucide:undo-2',
		'lucide:redo-2'
	])

	// Types
	type TextFormat = {
		label: string
		key: string
		icon: string
	}

	type ActiveMarks = {
		bold: boolean
		italic: boolean
		strike: boolean
		code: boolean
		highlight: boolean
		link: boolean
	}

	// Text format constants with embedded commands
	const TEXT_FORMATS: Record<string, TextFormat & { command: () => void }> = {
		PARAGRAPH: {
			label: 'Paragraph',
			key: 'paragraph',
			icon: 'lucide:pilcrow',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().setParagraph().run())
		},
		HEADING_1: {
			label: 'Heading 1',
			key: 'h1',
			icon: 'lucide:heading-1',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleHeading({ level: 1 }).run())
		},
		HEADING_2: {
			label: 'Heading 2',
			key: 'h2',
			icon: 'lucide:heading-2',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleHeading({ level: 2 }).run())
		},
		HEADING_3: {
			label: 'Heading 3',
			key: 'h3',
			icon: 'lucide:heading-3',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleHeading({ level: 3 }).run())
		},
		BULLET_LIST: {
			label: 'Bullet List',
			key: 'bulletList',
			icon: 'lucide:list',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleBulletList().run())
		},
		ORDERED_LIST: {
			label: 'Numbered List',
			key: 'orderedList',
			icon: 'lucide:list-ordered',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleOrderedList().run())
		},
		BLOCKQUOTE: {
			label: 'Quote',
			key: 'blockquote',
			icon: 'lucide:quote',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleBlockquote().run())
		},
		CODE_BLOCK: {
			label: 'Code Block',
			key: 'codeBlock',
			icon: 'lucide:code',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleCodeBlock().run())
		}
	} as const

	// Mark constants with embedded commands and icons
	const MARKS: Record<string, { key: string; icon: string; command: () => void }> = {
		BOLD: {
			key: 'bold',
			icon: 'lucide:bold',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleBold().run())
		},
		ITALIC: {
			key: 'italic',
			icon: 'lucide:italic',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleItalic().run())
		},
		STRIKE: {
			key: 'strike',
			icon: 'lucide:strikethrough',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleStrike().run())
		},
		CODE: {
			key: 'code',
			icon: 'lucide:code',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleCode().run())
		},
		HIGHLIGHT: {
			key: 'highlight',
			icon: 'lucide:highlighter',
			command: () => executeWithFormatUpdate(() => editor!.chain().focus().toggleHighlight().run())
		},
		LINK: {
			key: 'link',
			icon: 'lucide:link',
			command: () => toggleLink()
		}
	} as const

	let editor = $state<Editor>()
	let editorElement: HTMLDivElement

	// Track undo/redo availability
	let canUndo = $state(false)
	let canRedo = $state(false)

	// Track active text format/type
	let activeTextFormat = $state<TextFormat>(TEXT_FORMATS.PARAGRAPH)

	// Track active marks (bold, italic, etc.)
	let activeMarks = $state<ActiveMarks>({
		bold: false,
		italic: false,
		strike: false,
		code: false,
		highlight: false,
		link: false
	})

	// Dialog states
	let editing_link = $state(false)
	let editing_image = $state(false)
	let editing_video = $state(false)
	let current_link_value = $state<{ url: string; label: string; page?: string }>({ url: '', label: '' })
	let current_image_value = $state<{ url: string; alt: string }>({ url: '', alt: '' })
	let current_video_value = $state<{ url: string }>({ url: '' })
	let editing_existing_link = $state(false)
	let current_link_position = $state<{ from: number; to: number } | null>(null)

	// Derived value to resolve page from page ID
	let current_link_page = $derived(current_link_value.page ? Pages.one(current_link_value.page) : null)

	// Image editor overlay state
	let image_editor_visible = $state(false)
	let image_editor_element = $state<HTMLElement | null>(null)
	let current_image_position = $state<{ from: number; to: number } | null>(null)

	// Function to update active format and marks
	function updateActiveFormat() {
		if (!editor) return

		// Update active text format
		if (editor.isActive('bulletList')) activeTextFormat = TEXT_FORMATS.BULLET_LIST
		else if (editor.isActive('orderedList')) activeTextFormat = TEXT_FORMATS.ORDERED_LIST
		else if (editor.isActive('blockquote')) activeTextFormat = TEXT_FORMATS.BLOCKQUOTE
		else if (editor.isActive('codeBlock')) activeTextFormat = TEXT_FORMATS.CODE_BLOCK
		else if (editor.isActive('heading', { level: 1 })) activeTextFormat = TEXT_FORMATS.HEADING_1
		else if (editor.isActive('heading', { level: 2 })) activeTextFormat = TEXT_FORMATS.HEADING_2
		else if (editor.isActive('heading', { level: 3 })) activeTextFormat = TEXT_FORMATS.HEADING_3
		else activeTextFormat = TEXT_FORMATS.PARAGRAPH // default fallback

		// Update active marks
		activeMarks = {
			bold: editor.isActive(MARKS.BOLD.key),
			italic: editor.isActive(MARKS.ITALIC.key),
			strike: editor.isActive(MARKS.STRIKE.key),
			code: editor.isActive(MARKS.CODE.key),
			highlight: editor.isActive(MARKS.HIGHLIGHT.key),
			link: editor.isActive(MARKS.LINK.key)
		}
	}

	onMount(() => {
		editor = new Editor({
			element: editorElement,
			extensions: rich_text_extensions,
			content: entry?.value,
			editorProps: {
				attributes: {
					class: 'tiptap-editor'
				},
				handleDOMEvents: {
					click: (view, event) => {
						const target = event.target as HTMLElement

						if (target.tagName === 'A') {
							event.preventDefault()

							// Get the position of the clicked link
							const pos = view.posAtDOM(target, 0)
							const resolved = view.state.doc.resolve(pos)
							const linkMark = resolved.marks().find((mark) => mark.type.name === 'link')

							console.log('Link clicked:', { target, pos, linkMark, href: linkMark?.attrs?.href })

							if (linkMark) {
								// Extract link data
								const href = linkMark.attrs.href || ''
								const text = target.textContent || ''

								current_link_value = {
									url: href,
									label: text
								}
								current_link_position = { from: pos, to: pos + text.length }
								editing_existing_link = true
								editing_link = true
								return true
							}
						}

						return false
					},
					mouseover: (view, event) => {
						const target = event.target as HTMLElement
						if (target.tagName === 'IMG') {
							const src = target.getAttribute('src') || ''
							const alt = target.getAttribute('alt') || ''

							// Get the position of the hovered image
							const pos = view.posAtDOM(target, 0)
							const node = view.state.doc.nodeAt(pos)

							current_image_value = { url: src, alt }
							image_editor_element = target
							current_image_position = { from: pos, to: pos + (node?.nodeSize || 0) }
							image_editor_visible = true
							return true
						}
						return false
					}
				}
			},
			onUpdate({ editor }) {
				const changeData: Record<string, any> = {}
				changeData[field.key as string] = { 0: { value: editor.getJSON() } }
				onchange(changeData)
				updateHistoryState()
			},
			onSelectionUpdate() {
				updateHistoryState()
				updateActiveFormat()
			}
		})

		return () => {
			editor?.destroy()
		}
	})

	function updateHistoryState() {
		if (!editor) return
		canUndo = editor.can().undo()
		canRedo = editor.can().redo()
	}

	function run(command: () => void) {
		if (!editor) return
		try {
			command()
		} catch (error) {
			console.error('Editor command failed:', error)
		}
	}

	// Wrapper function for commands that need format updates
	function executeWithFormatUpdate(command: () => void) {
		if (!editor) return
		try {
			command()
			updateActiveFormat()
		} catch (error) {
			console.error('Format update command failed:', error)
		}
	}

	// Simple command functions for remaining buttons
	function undo() {
		if (!editor || !canUndo) return
		run(() => editor!.chain().focus().undo().run())
	}

	function redo() {
		if (!editor || !canRedo) return
		run(() => editor!.chain().focus().redo().run())
	}

	function setHorizontalRule() {
		run(() => editor!.chain().focus().setHorizontalRule().run())
	}

	function toggleLink() {
		if (!editor) return

		// Check if the current selection is already a link
		const linkMark = editor.getAttributes('link')

		if (linkMark.href) {
			// If we're already in a link, get its ID and text
			const { from, to } = editor.state.selection
			const selectedText = editor.state.doc.textBetween(from, to)

			// Store the link ID for later use
			current_link_position = null

			current_link_value = {
				url: linkMark.href,
				label: selectedText
			}

			editing_existing_link = true
		} else {
			// Creating a new link
			const { from, to } = editor.state.selection
			const selectedText = editor.state.doc.textBetween(from, to)

			current_link_value = {
				url: '',
				label: selectedText || ''
			}
			current_link_position = null
			editing_existing_link = false
		}

		editing_link = true
	}

	function insertImage() {
		current_image_value = { url: '', alt: '' }
		current_image_position = null
		editing_image = true
	}

	function insertYoutube() {
		current_video_value = { url: '' }
		editing_video = true
	}
</script>

<div class="RichText">
	<span class="primo--field-label">{field.label}</span>
	<div class="container">
		{#if editor}
			<div class="toolbar" in:fade={{ duration: 200 }}>
				<MenuPopup
					icon={activeTextFormat?.icon}
					label={activeTextFormat?.label}
					options={[
						{
							label: TEXT_FORMATS.PARAGRAPH.label,
							icon: TEXT_FORMATS.PARAGRAPH.icon,
							on_click: TEXT_FORMATS.PARAGRAPH.command,
							active: activeTextFormat?.key === TEXT_FORMATS.PARAGRAPH.key
						},
						{
							label: TEXT_FORMATS.HEADING_1.label,
							icon: TEXT_FORMATS.HEADING_1.icon,
							on_click: TEXT_FORMATS.HEADING_1.command,
							active: activeTextFormat?.key === TEXT_FORMATS.HEADING_1.key
						},
						{
							label: TEXT_FORMATS.HEADING_2.label,
							icon: TEXT_FORMATS.HEADING_2.icon,
							on_click: TEXT_FORMATS.HEADING_2.command,
							active: activeTextFormat?.key === TEXT_FORMATS.HEADING_2.key
						},
						{
							label: TEXT_FORMATS.HEADING_3.label,
							icon: TEXT_FORMATS.HEADING_3.icon,
							on_click: TEXT_FORMATS.HEADING_3.command,
							active: activeTextFormat?.key === TEXT_FORMATS.HEADING_3.key
						},
						{
							label: TEXT_FORMATS.BULLET_LIST.label,
							icon: TEXT_FORMATS.BULLET_LIST.icon,
							on_click: TEXT_FORMATS.BULLET_LIST.command,
							active: activeTextFormat?.key === TEXT_FORMATS.BULLET_LIST.key
						},
						{
							label: TEXT_FORMATS.ORDERED_LIST.label,
							icon: TEXT_FORMATS.ORDERED_LIST.icon,
							on_click: TEXT_FORMATS.ORDERED_LIST.command,
							active: activeTextFormat?.key === TEXT_FORMATS.ORDERED_LIST.key
						},
						{
							label: TEXT_FORMATS.BLOCKQUOTE.label,
							icon: TEXT_FORMATS.BLOCKQUOTE.icon,
							on_click: TEXT_FORMATS.BLOCKQUOTE.command,
							active: activeTextFormat?.key === TEXT_FORMATS.BLOCKQUOTE.key
						},
						{
							label: TEXT_FORMATS.CODE_BLOCK.label,
							icon: TEXT_FORMATS.CODE_BLOCK.icon,
							on_click: TEXT_FORMATS.CODE_BLOCK.command,
							active: activeTextFormat?.key === TEXT_FORMATS.CODE_BLOCK.key
						}
					]}
				/>

				<div class="separator"></div>

				<!-- Marks -->
				<RichTextButton icon={MARKS.BOLD.icon} active={activeMarks.bold} onclick={MARKS.BOLD.command} aria_label="Bold" />
				<RichTextButton icon={MARKS.ITALIC.icon} active={activeMarks.italic} onclick={MARKS.ITALIC.command} aria_label="Italic" />
				<RichTextButton icon={MARKS.STRIKE.icon} active={activeMarks.strike} onclick={MARKS.STRIKE.command} aria_label="Strikethrough" />
				<RichTextButton icon={MARKS.CODE.icon} active={activeMarks.code} onclick={MARKS.CODE.command} aria_label="Inline code" />
				<RichTextButton icon={MARKS.HIGHLIGHT.icon} active={activeMarks.highlight} onclick={MARKS.HIGHLIGHT.command} aria_label="Highlight" />
				<RichTextButton icon={MARKS.LINK.icon} active={activeMarks.link} onclick={MARKS.LINK.command} aria_label="Link" />
				<div class="separator"></div>

				<!-- Media -->
				<RichTextButton icon="lucide:minus" onclick={setHorizontalRule} aria_label="Horizontal rule" />
				<RichTextButton icon="lucide:image" onclick={insertImage} aria_label="Insert image" />
				<RichTextButton icon="lucide:youtube" onclick={insertYoutube} aria_label="Insert YouTube video" />
			</div>
		{/if}
		<div class="editor prose prose-invert relative" bind:this={editorElement} role="textbox" aria-label="Rich text editor" tabindex="0">
			{#if canUndo || canRedo}
				<div in:fade={{ duration: 200 }} class="absolute top-1 right-1 flex bg-[#222] z-10 rounded-md overflow-hidden opacity-90">
					{#if canUndo}<RichTextButton icon="lucide:undo-2" onclick={undo} aria_label="Undo" />{/if}
					{#if canRedo}
						<div class="separator"></div>
						<RichTextButton icon="lucide:redo-2" onclick={redo} aria_label="Redo" />
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Link Dialog -->
<Dialog.Root bind:open={editing_link}>
	<Dialog.Content class="z-[999] sm:max-w-[500px] pt-12 overflow-visible">
		<Dialog.Title>Edit link</Dialog.Title>
		<form
			onsubmit={(e) => {
				e.preventDefault()
				if (!editor || !current_link_value.label) return

				const chain = editor.chain().focus()
				const { from, to } = editor.state.selection
				const selectedText = editor.state.doc.textBetween(from, to)

				// Get the final URL (either from page ID or direct URL)
				let finalUrl = current_link_value.url
				if (current_link_page) {
					finalUrl = build_live_page_url(current_link_page)?.pathname || ''
				}

				if (editing_existing_link && current_link_position) {
					// Editing an existing link - use stored position
					const { from, to } = current_link_position
					chain
						.setTextSelection({ from, to })
						.deleteSelection()
						.insertContent({
							type: 'text',
							text: current_link_value.label,
							marks: [{ type: 'link', attrs: { href: finalUrl } }]
						})
						.run()
				} else {
					// Creating a new link
					const linkId = createUniqueID()

					// Determine if we need to delete selection first
					const shouldDeleteSelection = selectedText

					if (shouldDeleteSelection) {
						chain
							.deleteSelection()
							.insertContent({
								type: 'text',
								text: current_link_value.label,
								marks: [{ type: 'link', attrs: { href: finalUrl, 'data-id': linkId } }]
							})
							.run()
					} else {
						chain
							.insertContent({
								type: 'text',
								text: current_link_value.label,
								marks: [{ type: 'link', attrs: { href: finalUrl, 'data-id': linkId } }]
							})
							.run()
					}
				}

				editing_link = false
				editing_existing_link = false
				current_link_position = null
			}}
		>
			<LinkField
				field={{ id: 'temp-link', label: 'Link', key: 'link', type: 'link', config: {}, index: 0 }}
				entry={{ id: 'temp-entry', locale: 'en', value: current_link_value, field: 'temp-link', index: 0 } as any}
				onchange={(changeData) => {
					const fieldKey = Object.keys(changeData)[0]
					const newValue = changeData[fieldKey][0].value as { url: string; label: string; page?: string }
					console.log({ changeData, newValue })
					current_link_value = newValue
				}}
			/>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (editing_link = false)}>Cancel</Button>
				<Button type="submit">Done</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Image Dialog -->
<Dialog.Root bind:open={editing_image}>
	<Dialog.Content class="z-[999] sm:max-w-[500px] pt-12 overflow-visible">
		<Dialog.Title>Edit image</Dialog.Title>
		<form
			onsubmit={(e) => {
				e.preventDefault()
				if (!editor || !current_image_value.url) return

				if (current_image_position) {
					// Editing an existing image - use stored position
					const { from, to } = current_image_position
					run(() =>
						editor!
							.chain()
							.setTextSelection({ from, to })
							.deleteSelection()
							.insertContent({
								type: 'image',
								attrs: {
									src: current_image_value.url,
									alt: current_image_value.alt
								} as any
							})
							.run()
					)
				} else {
					// Creating a new image
					run(() =>
						editor!
							.chain()
							.focus()
							.insertContent({
								type: 'image',
								attrs: {
									src: current_image_value.url,
									alt: current_image_value.alt,
									'data-id': createUniqueID()
								} as any
							})
							.run()
					)
				}

				editing_image = false
				current_image_position = null
			}}
		>
			<ImageField
				field={{ id: 'temp-image', label: 'Image', key: 'image', type: 'image', config: {}, index: 0 }}
				entry={{ id: 'temp-entry', locale: 'en', value: current_image_value, field: 'temp-image', index: 0 } as any}
				show_focal_point={false}
				onchange={(changeData) => {
					const fieldKey = Object.keys(changeData)[0]
					const newValue = changeData[fieldKey][0].value as { url: string; alt: string }
					current_image_value = newValue
				}}
			/>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (editing_image = false)}>Cancel</Button>
				<Button type="submit">Done</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Video Dialog -->
{#if editing_video}
	<VideoModal
		bind:value={current_video_value}
		onsave={() => {
			if (current_video_value.url) {
				run(() => editor!.commands.setYoutubeVideo({ src: current_video_value.url }))
			}
			editing_video = false
		}}
	/>
{/if}

<!-- Image Editor Overlay -->
{#if image_editor_visible}
	<ImageEditorOverlay
		bind:visible={image_editor_visible}
		bind:image_element={image_editor_element}
		onClick={() => {
			// Open the image dialog with current image data
			editing_image = true
			image_editor_visible = false
		}}
		onDelete={() => {
			// Delete the hovered image using editor commands
			if (editor && current_image_position) {
				const { from, to } = current_image_position
				run(() => editor!.chain().setTextSelection({ from, to }).deleteSelection().setTextSelection(from).focus().run())
			}
			image_editor_visible = false
			current_image_position = null
		}}
	/>
{/if}

<style lang="postcss">
	.RichText {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.toolbar {
		display: flex;
		border: 1px solid var(--color-gray-8);
		border-bottom: 0;
		overflow-x: auto;
		white-space: nowrap;
	}

	.separator {
		width: 1px;
		background: var(--color-gray-8);
	}

	.container {
		position: relative;
		display: flex;
		flex-direction: column;
		min-height: 200px;
		padding-top: 0;
		border-radius: var(--input-border-radius);
		background: var(--primo-color-codeblack);
		color: var(--color-gray-2);
		overflow-y: auto;
	}

	.editor {
		flex: 1;
		width: 100%;
		max-width: none;
		border: 1px solid var(--color-gray-8);
		display: flex;
		flex-direction: column;
	}

	.editor :global(.tiptap-editor) {
		flex: 1;
		width: 100%;
		padding: 0.75rem;
	}

	.editor :global(.tiptap-editor:focus) {
		outline: none;
		box-shadow: 0 0 0 1px var(--color-gray-7);
	}

	.editor :global(.tiptap-editor p) {
		margin: 0.25rem 0;
	}

	/* Override prose heading top margins for editor - only for first child */
	.editor :global(.tiptap-editor :where(h1, h2, h3, h4, h5, h6):first-child) {
		margin-top: 0 !important;
	}
</style>
