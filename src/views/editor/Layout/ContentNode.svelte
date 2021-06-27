<script>
  import {onMount,onDestroy,createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()
  import CopyButton from './CopyButton.svelte'

  import {createDebouncer} from '../../../utils'
  const slowDebounce = createDebouncer(500)

  // import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
  
  import { Editor, Extension } from '@tiptap/core/src/index'
  import { defaultExtensions } from '@tiptap/starter-kit'
	import BubbleMenu from '@tiptap/extension-bubble-menu'
  import Link from '@tiptap/extension-link'
  import Highlight from '@tiptap/extension-highlight'
  import OrderedList from '@tiptap/extension-ordered-list'
  import ListItem from '@tiptap/extension-list-item'
  import BulletList from '@tiptap/extension-bullet-list'
  import Blockquote from '@tiptap/extension-blockquote'
  import CodeBlock from '@tiptap/extension-code-block'
  import Image from '@tiptap/extension-image'
  import Dropcursor from '@tiptap/extension-dropcursor'

  import FloatingMenu from '@tiptap/extension-floating-menu'

  export let block

  let floatingMenu
	let bubbleMenu
  let element
  let editor

  // seems to be the only way to detect key presses
  const KeyboardShortcuts = Extension.create({
    addKeyboardShortcuts() {
      return {
        // Delete the block when backspacing in an empty node
        'Backspace': () => {
          if (focused && editor.isEmpty) {
            dispatch('delete')
            editor && editor.destroy()
          }
          return false
        },
        'Mod-s': () => {
          dispatch('save')
          return true
        },
      }
    },
  })

  let focused = false
  onMount(() => {
    editor = new Editor({
      // autofocus: true,
      element: element,
      extensions: [
				...defaultExtensions(),
				BubbleMenu.configure({
		      element: bubbleMenu,
    		}),
        Link,
        Highlight.configure({ multicolor: false }),
        FloatingMenu.configure({
          element: floatingMenu,
        }),
        KeyboardShortcuts,
        Image, 
			],
      content: block.value.html,
      onTransaction() {
        // force re-render so `editor.isActive` works as expected
        editor = editor
      },
      onUpdate: ({editor}) => {
        dispatch('debounce')
        return slowDebounce([() => {
          dispatch('change',editor.getHTML())
        }])
      }, 
      onFocus({ editor, event }) {
        focused = true
        // dispatch('focus', selection)
      },
      onBlur() {
  //       focusedNode.update(e => ({ ...e, focused: false }))
        focused = false
        dispatch('blur')
      }
    })
    setTimeout(() => {
      editor.chain().focus()
    }, 200)
  })
	
  onDestroy(() => {
    editor.destroy()
  })

  function setLink() {
    const url = window.prompt('URL')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  function addImage() {
    const url = window.prompt('URL')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

</script>

<div class="primo-copy" id="copy-{block.id}" bind:this={element}>
	<div class="floatingMenu" bind:this="{floatingMenu}">
		{#if editor}
      <CopyButton icon="heading" on:click={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
      <CopyButton icon="code" on:click={() => editor.chain().focus().toggleCodeBlock().run()} />
      <CopyButton icon="quote-left" on:click={() => editor.chain().focus().toggleBlockquote().run()} />
      <CopyButton icon="list-ul" on:click={() => editor.chain().focus().toggleBulletList().run()} />
      <CopyButton icon="list-ol" on:click={() => editor.chain().focus().toggleOrderedList().run()} />
      <CopyButton icon="image" on:click={addImage} />
		{/if}
	</div>
	<div class="bubble-menu" bind:this="{bubbleMenu}">
		{#if editor}
      <CopyButton icon="link" on:click={setLink} />
      <CopyButton icon="bold" on:click={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
      <CopyButton icon="italic" on:click={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
      <CopyButton icon="highlighter" on:click={editor.chain().focus().toggleHighlight({ color: '' }).run()} active={editor.isActive('highlight')} />
		{/if}
	</div>
</div>

<style>
  .primo-copy {
    caret-color: rgb(248,68,73);
  }

  :global(.primo-copy ::selection, ::-moz-selection) {
    background: rgb(248,68,73); 
  }

  :global(.primo-copy .ProseMirror) {
    white-space: pre-wrap;
    word-wrap: break-word;
    outline: 0;
  }

  .bubble-menu {
    --tw-translate-y: -0.5rem;
    --tw-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    display: flex;
    border-radius: 0.125rem;
    margin-left: 0.5rem;
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms; /*do we still need this */
    transition-duration: 200ms; 
    font-size: 0.875rem;
    line-height: 1.25rem;
    z-index: 99999 !important;
    transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
    background-color: rgba(30, 30, 30, var(--tw-bg-opacity));
    color: rgba(245, 245, 245, var(--tw-text-opacity));
    border-bottom-width: 2px;
    border-color: rgba(248, 68, 73, var(--tw-border-opacity));
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
  }
  .floatingMenu{
    --tw-translate-y: -0.5rem;
    --tw-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    display: flex;
    border-radius: 0.125rem;
    margin-left: 0.5rem;
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms; /*do we still need this */
    transition-duration: 200ms;
    font-size: 0.875rem; /* do we need this*/
    line-height: 1.25rem; /* do we need this*/
    font-size: 0.75rem;
    line-height: 1rem;
    z-index: 99999 !important;
    transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
    color: rgba(38, 38, 38, var(--tw-text-opacity));
    background-color: rgba(255, 255, 255, var(--tw-bg-opacity));
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);

  }
	
	/* :global(.bubble-menu button:hover, .bubble-menu button.is-active) {
		opacity: 1;
	}	 */
</style>