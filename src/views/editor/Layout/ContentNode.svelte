<script>
  import {onMount,onDestroy,createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  import {createEditor} from '../../../libraries/prosemirror/prosemirror.js'
  import {focusedNode} from '../../../stores/app'
  import CopyButton from './CopyButton.svelte'
  // import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
  
  import { Editor, Extension } from '@tiptap/core'
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

  let focused = false
  onMount(() => {

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
          },
        }
      },
    })

    alert('yes')

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
        OrderedList,
        KeyboardShortcuts,
        BulletList,
        ListItem,
        Blockquote,
        CodeBlock,
        Image, 
        Dropcursor
			],
      content: block.value.html,
      onTransaction({ editor, transaction }) {
        // force re-render so `editor.isActive` works as expected
        editor = editor
        // backspacing when no content exists
      },
      onUpdate({ editor }) {
        // The content has changed.
        dispatch('change',editor.getHTML())
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
	<div class="bubble-menu text-gray-800 text-xs" bind:this="{floatingMenu}">
		{#if editor}
      <CopyButton icon="heading" on:click={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
      <CopyButton icon="code" on:click={() => editor.chain().focus().toggleCodeBlock().run()} />
      <CopyButton icon="quote-left" on:click={() => editor.chain().focus().toggleBlockquote().run()} />
      <CopyButton icon="list-ul" on:click={() => editor.chain().focus().toggleBulletList().run()} />
      <CopyButton icon="list-ol" on:click={() => editor.chain().focus().toggleOrderedList().run()} />
      <CopyButton icon="image" on:click={addImage} />
		{/if}
	</div>
	<div class="bubble-menu bg-gray-900 text-gray-100 " bind:this="{bubbleMenu}">
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
    @apply ml-2 flex transition-opacity duration-200 text-sm z-50 transform -translate-y-1;
	}
	
	/* :global(.bubble-menu button:hover, .bubble-menu button.is-active) {
		opacity: 1;
	}	 */
</style>