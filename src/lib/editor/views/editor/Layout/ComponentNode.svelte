<script context="module">
  import { writable } from 'svelte/store'
  export const positions = writable([])
</script>

<script>
  import _ from 'lodash-es'
  import { fade } from 'svelte/transition'
  import Icon from '@iconify/svelte'
  import { Editor, Extension } from '@tiptap/core'
  import sections from '../../../stores/data/sections'
  import StarterKit from '@tiptap/starter-kit'
  import Highlight from '@tiptap/extension-highlight'
  import Link from '@tiptap/extension-link'
  import BubbleMenu from '@tiptap/extension-bubble-menu'
  import FloatingMenu from '@tiptap/extension-floating-menu'
  import { tick, createEventDispatcher, getContext } from 'svelte'
  import { browser } from '$app/environment'
  import { processCode } from '../../../utils'
  import { content, pages } from '../../../stores/data/draft'
  import { locale } from '../../../stores/app/misc'
  import { getComponentData, getPageData } from '../../../stores/helpers'
  import { update_section_content } from '../../../stores/actions'
  import CopyButton from './CopyButton.svelte'
  import modal from '../../../stores/app/modal'
  import { converter } from '$lib/editor/field-types/Markdown.svelte'

  const dispatch = createEventDispatcher()

  export let i
  export let block

  let node
  $: if (node) {
    setTimeout(set_position, 3000)
  }

  $: $sections, set_position()
  async function set_position() {
    await tick()
    if (!node) return

    let imagesLoaded = 0
    let totalImages = node.querySelectorAll('img').length

    if (totalImages === 0) {
      set_positions()
    } else {
      node.querySelectorAll('img').forEach((img) => {
        let newImg = new Image()
        newImg.onload = imageLoaded
        newImg.src = img.src
      })

      function imageLoaded() {
        imagesLoaded++
        if (imagesLoaded === totalImages) {
          set_positions()
        }
      }
    }
  }

  async function set_positions() {
    if (!node) return
    // await tick();
    const rect = node.getBoundingClientRect()
    const { y, left, height } = rect
    $positions = [
      ...$positions.filter((position) => position.id !== block.id),
      {
        i,
        id: block.id,
        symbol: block.symbol.id,
        top: y,
        bottom: y + height,
        left,
      },
    ]
  }

  $: symbol = block.symbol
  $: $content, $locale, block, setComponentData()

  let component_data
  let parent_data
  $: combined_data = {
    ...parent_data,
    ...component_data,
  }

  function setComponentData() {
    component_data = getComponentData({
      component: block,
      include_parent_data: false,
    })
    parent_data = getPageData({})
  }

  let html = ''
  let css = ''
  let js = ''
  $: compileComponentCode(symbol.code)

  async function save_edited_value(key, value) {
    _.set(component_data, key, value)
    await update_section_content(block, {
      ...block.content,
      [$locale]: component_data,
    })
  }

  let editor
  let floatingMenu, bubbleMenu

  let image_editor
  let image_editor_is_visible = false

  let link_editor
  let link_editor_is_visible = false

  function create_editor({ key, html, element }) {
    const editor = new Editor({
      content: html,
      element,
      extensions: [
        StarterKit,
        Link.configure({
          HTMLAttributes: {
            class: 'link',
          },
          openOnClick: false,
        }),
        // TipTapImage.configure({}),
        Highlight.configure({ multicolor: false }),
        FloatingMenu.configure({
          element: floatingMenu,
        }),
        BubbleMenu.configure({
          element: bubbleMenu,
        }),
        Extension.create({
          onFocus() {
            dispatch('lock')
          },
          onBlur() {
            dispatch('unlock')
            const html = editor.getHTML()
            save_edited_value(key, {
              html,
              markdown: converter.makeMarkdown(html),
            })
          },
        }),
      ],
    })
  }

  let error = ''
  async function compileComponentCode(rawCode) {
    if (!node) {
      setTimeout(() => compileComponentCode(rawCode), 200)
      return
    }
    // workaround for this function re-running anytime something changes on the page
    // (as opposed to when the code actually changes)
    if (html !== rawCode.html || css !== rawCode.css || js !== rawCode.js) {
      html = rawCode.html
      css = rawCode.css
      js = rawCode.js
      const res = await processCode({
        component: {
          ...rawCode,
          data: combined_data,
        },
        buildStatic: false,
      })
      if (res.error) {
        error = res.error
      } else if (res.js) {
        error = ''
        if (component) component.$destroy()
        const blob = new Blob([res.js], { type: 'text/javascript' })
        const url = URL.createObjectURL(blob)

        const { default: App } = await import(/* @vite-ignore */ url)
        component = new App({
          target: node,
          props: combined_data,
        })

        make_content_editable()
      }
    }
  }

  async function make_content_editable() {
    if (!node) return
    const valid_elements = Array.from(node.querySelectorAll('*')).filter(
      (element) => {
        if (['STYLE', 'TITLE'].includes(element.tagName)) return false

        const [child_node] = Array.from(element.childNodes).filter((node) => {
          const has_text =
            node?.nodeName === '#text' && node.nodeValue.trim().length > 0
          return has_text
        })

        const html = element?.innerHTML?.trim() || ''

        if (
          html ||
          child_node ||
          element.tagName === 'IMG' ||
          element.tagName === 'A'
        ) {
          return true
        }
      }
    )

    // loop over component_data and match to elements
    const tagged_elements = new Set() // elements that have been matched to a component_data key
    for (const [key, val] of Object.entries(component_data)) {
      const is_link =
        typeof val === 'object' &&
        Object.hasOwn(val, 'url') &&
        Object.hasOwn(val, 'label')

      const is_image =
        typeof val === 'object' &&
        Object.hasOwn(val, 'url') &&
        Object.hasOwn(val, 'alt')

      const is_markdown =
        typeof val === 'object' &&
        Object.hasOwn(val, 'html') &&
        Object.hasOwn(val, 'markdown')

      if (typeof val === 'string' || is_link || is_image || is_markdown) {
        // value is text
        search_elements_for_value(key, val)
      } else if (Array.isArray(val)) {
        // value is repeater
        for (const [index, item] of Object.entries(val)) {
          for (const [subkey, val] of Object.entries(item)) {
            search_elements_for_value(`${key}[${index}].${subkey}`, val)
          }
        }
      } else if (typeof val === 'object' && val !== null) {
        // value is group
        Object.entries(val).forEach(([subkey, subvalue]) => {
          search_elements_for_value(`${key}.${subkey}`, subvalue)
        })
      }
    }

    function search_elements_for_value(key, val) {
      for (const element of valid_elements) {
        if (tagged_elements.has(element)) continue // element is already tagged, skip

        const matched = match_value_to_element(key, val, element)
        if (matched) {
          tagged_elements.add(element)
          break
        }
      }
    }

    function match_value_to_element(key, value, element) {
      if (value === '' || !value) return false

      const html = element.innerHTML?.trim()
      const text = element.innerText?.trim()

      const text_matches = typeof value == 'string' && value.trim() === text

      const is_html = typeof value === 'object' && !!value.html

      const is_image =
        typeof value === 'object' && value.alt !== undefined && value.url

      const is_link =
        typeof value === 'object' &&
        Object.hasOwn(value, 'url') &&
        Object.hasOwn(value, 'label')

      const key_matches = element.dataset.key === key
      if (key_matches) {
        if (is_html) {
          set_editable_editor({ element, key })
        } else if (is_image) {
          set_editable_image({ element, key })
        } else if (is_link) {
          set_editable_link({ element, key, url: value.url })
        } else {
          set_editable({ element, key })
        }
        return true
      }

      if (is_link && typeof element.href === 'string') {
        const external_url_matches =
          value.url?.replace(/\/$/, '') === element.href?.replace(/\/$/, '')
        const internal_url_matches =
          window.location.origin + value.url?.replace(/\/$/, '') ===
          element.href?.replace(/\/$/, '')

        if (
          (external_url_matches || internal_url_matches) &&
          value.label === element.innerText
        ) {
          set_editable_link({ element, key, url: value.url })
          return true
        }
      } else if (is_image) {
        const image_matches =
          value.alt === element.alt && value.url === element.src
        if (image_matches) {
          set_editable_image({ element, key })
          return true
        }
      } else if (text_matches) {
        // Markdown Field
        set_editable({ element, key })
        return true
      } else if (is_html) {
        const html_matches = html === value.html
        if (html_matches) {
          set_editable_editor({ element, key })
          return true
        }
      } else {
        // console.log('no match', { element, key, value })
        return false
      }
    }

    async function set_editable_image({ element, key = '' }) {
      let rect
      element.setAttribute(`data-key`, key)
      element.onmouseover = async (e) => {
        image_editor_is_visible = true
        await tick()
        rect = element.getBoundingClientRect()
        image_editor.style.left = `${rect.left}px`
        image_editor.style.top = `${rect.top}px`
        image_editor.style.width = `${rect.width}px`
        image_editor.style.height = `${rect.height}px`
        image_editor.style.borderRadius = getComputedStyle(element).borderRadius
        image_editor.onmouseleave = (e) => {
          const is_outside =
            e.x >= Math.floor(rect.right) ||
            e.y >= Math.floor(rect.bottom) ||
            e.x <= Math.floor(rect.left) ||
            e.y <= Math.floor(rect.top)
          if (is_outside) {
            image_editor_is_visible = false
          }
        }
        image_editor.onclick = () => {
          modal.show('DIALOG', {
            component: 'IMAGE',
            onSubmit: ({ url, alt }) => {
              element.src = url
              save_edited_value(key, { url, alt })
              image_editor_is_visible = false
              modal.hide()
            },
            props: {
              value: {
                url: element.src,
                alt: element.alt,
              },
            },
          })
        }
      }
    }

    async function set_editable_editor({ element, key = '' }) {
      const html = element.innerHTML.trim()
      element.innerHTML = ''
      create_editor({
        key,
        html,
        element,
      })
    }

    async function set_editable_link({ element, key, url }) {
      element.style.outline = '0'
      element.setAttribute(`data-key`, key)
      element.contentEditable = true

      let rect
      element.onkeydown = (e) => {
        if (e.code === 'Enter') {
          e.preventDefault()
          e.target.blur()
          link_editor_is_visible = false
        }
      }
      element.onblur = (e) => {
        dispatch('unlock')
        save_edited_value(key, {
          url: element.href,
          label: element.innerText,
        })
      }
      element.addEventListener('click', async () => {
        rect = element.getBoundingClientRect()

        link_editor_is_visible = true
        await tick()
        link_editor.style.left = `${rect.left}px`
        link_editor.style.top = `${rect.top + rect.height}px`

        const input = link_editor.querySelector('input')
        input.value = url

        const form = link_editor.querySelector('form')
        form.onsubmit = (e) => {
          e.preventDefault()
          element.href = input.value
          save_edited_value(key, {
            url: input.value,
            label: element.innerText,
          })
          link_editor_is_visible = false
        }

        const button = link_editor.querySelector('button[data-link]')
        button.onclick = () => {
          window.open(element.href, '_blank')
        }
      })
    }

    async function set_editable({ element, key = '' }) {
      element.style.outline = '0'
      element.setAttribute(`data-key`, key)
      element.onblur = (e) => {
        dispatch('unlock')
        save_edited_value(key, e.target.innerText)
      }
      element.onfocus = () => {
        dispatch('lock')
      }
      element.contentEditable = true
      // await tick()
    }
  }

  let local_component_data
  $: hydrateComponent(component_data)
  async function hydrateComponent(data) {
    if (!component) return
    else if (error) {
      error = null
      compileComponentCode(symbol.code)
    } else if (!_.isEqual(data, local_component_data)) {
      // TODO: re-render the component if `data` doesn't match its fields (e.g. when removing a component field to add to the page)
      component.$set(data)
      setTimeout(make_content_editable, 200)
      local_component_data = _.cloneDeep(data)
    }
  }

  let component

  // Fade in component on mount
  let observer
  if (browser) {
    observer = new MutationObserver(() => {
      dispatch('mount')
      reroute_links()
    })
  }

  // Reroute links to correctly open externally and internally
  async function reroute_links() {
    const { pathname, origin } = window.location
    const [site] = pathname.split('/').slice(1)
    const homeUrl = `${origin}/${site}`
    node.querySelectorAll('a').forEach((link) => {
      link.onclick = (e) => {
        e.preventDefault()
      }

      // link internally
      if (window.location.host === link.host) {
        // link navigates to site home
        if (link.pathname === '/') {
          link.setAttribute('href', homeUrl)
          return
        }

        const [linkedPageID] = link.pathname.split('/').slice(1)

        // Link to page
        const linkedPage = _.find($pages, ['id', linkedPageID])
        if (linkedPage) {
          link.setAttribute('href', `${homeUrl}/${linkedPageID}`)
        } else {
          // TODO: Create page
        }
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

  $: if (node) {
    observer.observe(node, {
      childList: true,
    })
  }

  $: if (error) {
    dispatch('mount')
  }

  $: if (browser && node) {
    node.closest('#page').addEventListener('scroll', on_page_scroll)
  }

  function on_page_scroll() {
    set_position()
    image_editor_is_visible = false
    link_editor_is_visible = false
  }

  // Workaround for meny breaking when rearranging
  const menu_observer = browser
    ? new MutationObserver((e) => {
        if (e[0].addedNodes.length === 0) {
          // menu is janky, so we need to re-create it
          editor.destroy()
          // create_editor()
        }
      })
    : null
  $: if (bubbleMenu) {
    menu_observer?.observe(bubbleMenu, {
      childList: true,
    })
  }
</script>

{#if image_editor_is_visible}
  <button
    in:fade={{ duration: 100 }}
    class="primo-reset image-editor"
    bind:this={image_editor}
  >
    <Icon icon="uil:image-upload" />
  </button>
{/if}

{#if link_editor_is_visible}
  <div
    in:fade={{ duration: 100 }}
    class="primo-reset link-editor"
    bind:this={link_editor}
  >
    <button
      on:click={() => {
        link_editor_is_visible = false
      }}
    >
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

<div bind:this={node} />
{#if error}
  <pre>
    {@html error}
  </pre>
{/if}

<div class="menu floating-menu primo-reset" bind:this={floatingMenu}>
  {#if editor}
    <CopyButton
      icon="heading"
      on:click={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
    />
    <CopyButton
      icon="code"
      on:click={() => editor.chain().focus().toggleCodeBlock().run()}
    />
    <CopyButton
      icon="quote-left"
      on:click={() => editor.chain().focus().toggleBlockquote().run()}
    />
    <CopyButton
      icon="list-ul"
      on:click={() => editor.chain().focus().toggleBulletList().run()}
    />
    <CopyButton
      icon="list-ol"
      on:click={() => editor.chain().focus().toggleOrderedList().run()}
    />
    <!-- <CopyButton
			icon="image"
			on:click={() =>
				modal.show('DIALOG', {
					component: 'IMAGE',
					onSubmit: ({ url, alt }) => {
						editor.chain().focus().setImage({ src: url, alt }).run();
						modal.hide();
					}
				})}
		/> -->
  {/if}
</div>
<div class="menu bubble-menu primo-reset" bind:this={bubbleMenu}>
  {#if editor}
    <CopyButton
      icon="link"
      on:click={() =>
        modal.show('DIALOG', {
          component: 'LINK',
          onSubmit: (val) => {
            editor.chain().focus().setLink({ href: val }).run()
            modal.hide()
          },
        })}
    />
    <CopyButton
      icon="bold"
      on:click={() => editor.chain().focus().toggleBold().run()}
      active={editor.isActive('bold')}
    />
    <CopyButton
      icon="italic"
      on:click={() => editor.chain().focus().toggleItalic().run()}
      active={editor.isActive('italic')}
    />
    <CopyButton
      icon="highlighter"
      on:click={editor.chain().focus().toggleHighlight().run()}
      active={editor.isActive('highlight')}
    />
  {/if}
</div>

<style lang="postcss">
  :global(.ProseMirror) {
    outline: 0 !important;
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
    margin-left: 0.5rem;
    transition: opacity 0.1s;
    z-index: 999999 !important;
    box-shadow: 0 0 #0000, 0 0 #0000, 0 1px 2px 0 rgba(0, 0, 0, 0.05);
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
    overflow: hidden;

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
    z-index: 99;
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
