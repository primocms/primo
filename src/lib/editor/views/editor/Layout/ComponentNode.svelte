<script context="module">
  import { writable } from 'svelte/store'
  export const positions = writable([])
</script>

<script>
  import _ from 'lodash-es'
  import { Editor, Extension } from '@tiptap/core'
  import activePage, { sections } from '../../../stores/app/activePage'
  import StarterKit from '@tiptap/starter-kit'
  import Highlight from '@tiptap/extension-highlight'
  import Link from '@tiptap/extension-link'
  import BubbleMenu from '@tiptap/extension-bubble-menu'
  import FloatingMenu from '@tiptap/extension-floating-menu'
  import { tick, createEventDispatcher, getContext } from 'svelte'
  import { browser } from '$app/environment'
  import { processCode } from '../../../utils'
  import {
    site as unsavedSite,
    content,
    symbols,
    pages,
  } from '../../../stores/data/draft'
  import { locale } from '../../../stores/app/misc'
  import { getComponentData } from '../../../stores/helpers'
  import { updateContent } from '../../../stores/actions'
  import CopyButton from './CopyButton.svelte'
  import modal from '../../../stores/app/modal'

  const dispatch = createEventDispatcher()

  export let i
  export let block
  // export let node
  export let site = $unsavedSite

  let node
  $: if (node) {
    setTimeout(set_position, 3000)
  }

  $: $sections, set_position()
  async function set_position() {
    if (!node) return
    await tick()

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
        symbol: block.symbolID,
        top: y,
        bottom: y + height,
        left,
      },
    ]
  }

  const is_preview = getContext('is-preview')

  $: symbol = _.find(is_preview ? site.symbols : $symbols, [
    'id',
    block.symbolID,
  ])
  $: $content, $locale, block, setComponentData()

  let componentData
  function setComponentData() {
    componentData = getComponentData({
      component: block,
      loc: $locale,
      site: is_preview ? site : $unsavedSite,
    })
  }

  let html = ''
  let css = ''
  let js = ''
  $: compileComponentCode(symbol.code)

  function save_edited_value(key, value) {
    _.set(componentData, key, value)
    updateContent(block.id, componentData)
  }

  let editor
  let local_html, local_element, local_key
  let floatingMenu, bubbleMenu
  function create_editor() {
    editor = new Editor({
      content: local_html,
      element: local_element,
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
            save_edited_value(local_key, editor.getHTML())
          },
        }),
      ],
    })
  }

  let error = ''
  async function compileComponentCode(rawCode) {
    // workaround for this function re-running anytime something changes on the page
    // (as opposed to when the code actually changes)
    if (html !== rawCode.html || css !== rawCode.css || js !== rawCode.js) {
      html = rawCode.html
      css = rawCode.css
      js = rawCode.js
      const res = await processCode({
        component: {
          ...rawCode,
          data: componentData,
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
          props: componentData,
        })

        const elements_with_text = Array.from(
          node.querySelectorAll('*')
        ).filter((element) => {
          if (['STYLE', 'TITLE'].includes(element.tagName)) return false

          const [child_node] = Array.from(element.childNodes).filter((node) => {
            const has_text =
              node?.nodeName === '#text' && node.nodeValue.trim().length > 0
            return has_text
          })

          const html = element?.innerHTML?.trim() || ''

          if (html || child_node) {
            return true
          }
        })

        // loop over componentData and match to elements
        const tagged_elements = new Set() // elements that have been matched to a componentData key
        for (const [key, val] of Object.entries(componentData)) {
          if (typeof val === 'string') {
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
            Object.entries(val).forEach(([subkey, subvalue]) => {
              search_elements_for_value(`${key}.${subkey}`, subvalue)
            })
          }
        }

        function search_elements_for_value(key, val) {
          for (const element of elements_with_text) {
            if (tagged_elements.has(element)) continue // element is already tagged, skip

            const matched = match_value_to_element(key, val, element)
            if (matched) {
              tagged_elements.add(element)
              break
            }
          }
        }

        function match_value_to_element(key, value, element) {
          const has_html = element.innerHTML.includes('<!-- HTML_TAG_START -->')
          // const html = has_html
          // 	? element.innerHTML
          // 			.replace(new RegExp('<!-- HTML_TAG_START -->|<!-- HTML_TAG_END -->', 'g'), '')
          // 			.replace(/\s/g, '')
          // 	: '';
          const html = element.innerHTML.trim()
          const text = element.innerText?.trim()

          const html_matches = typeof value == 'string' && value.trim() === html
          const text_matches = typeof value == 'string' && value.trim() === text

          // if (has_html && !html_matches) {
          // 	console.log('NO MATCH', key, { value, html });
          // }

          if (text_matches) {
            // Markdown Field
            set_editable({ element, key })
            return true
          } else if (html_matches) {
            // Text Field
            set_editable({ element, key, should_create_editor: true })
            return true
          } else return false
        }

        async function set_editable({
          element,
          key = '',
          should_create_editor = false,
        }) {
          element.style.outline = '0'

          if (should_create_editor) {
            local_html = element.innerHTML.trim()
            local_element = element
            local_key = key
            element.innerHTML = ''
            create_editor()
          } else {
            element.setAttribute(`data-key`, key)
            element.onblur = (e) => {
              dispatch('unlock')
              save_edited_value(key, e.target.innerText)
            }
            element.onfocus = () => {
              dispatch('lock')
            }
            element.contentEditable = true
          }
        }
      }
    }
  }

  $: hydrateComponent(componentData)
  async function hydrateComponent(data) {
    if (!component) return
    else if (error) {
      error = null
      compileComponentCode(symbol.code)
    } else {
      // TODO: re-render the component if `data` doesn't match its fields (e.g. when removing a component field to add to the page)
      component.$set(data)
    }
  }

  let component

  // Fade in component on mount
  const observer = new MutationObserver(() => {
    dispatch('mount')
    reroute_links()
  })

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
    node.closest('#page').addEventListener('scroll', set_position)
  }

  // Workaround for meny breaking when rearranging
  const menu_observer = browser
    ? new MutationObserver((e) => {
        if (e[0].addedNodes.length === 0) {
          // menu is janky, so we need to re-create it
          editor.destroy()
          create_editor()
        }
      })
    : null
  $: if (bubbleMenu) {
    menu_observer?.observe(bubbleMenu, {
      childList: true,
    })
  }
</script>

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

<style>
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
</style>
