<script>
  import {isEqual, cloneDeep} from 'lodash-es'
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  import CopyButton from './CopyButton.svelte';

  import unsavedSite from '../../../stores/data/draft'
  import {id as pageID} from '../../../stores/app/activePage'
  import modal from '../../../stores/app/modal'
  import {locale} from '../../../stores/app/misc'
  import {changeLocale} from '../../../stores/actions'
  import { createDebouncer } from '../../../utils';
  const slowDebounce = createDebouncer(500);

  import { Editor, Extension } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Highlight from '@tiptap/extension-highlight';
  import Link from '@tiptap/extension-link';
  import BubbleMenu from '@tiptap/extension-bubble-menu';
  import Image from '@tiptap/extension-image';
  import FloatingMenu from '@tiptap/extension-floating-menu';

  export let block
  export let site
  
  let node;

  let floatingMenu;
  let bubbleMenu;
  let editor;

  let content = (site || $unsavedSite).content[$locale]?.[$pageID]?.[block.id] || ''
  let cachedContent
  $: updateNodeContent($locale, $pageID, block.id) 
  function updateNodeContent(locale, pageID, blockID) {
    if (!editor || isEqual(content, cachedContent)) return
    const updatedContent = (site || $unsavedSite).content?.[locale]?.[pageID]?.[blockID] || ''
    editor.commands.setContent(updatedContent)
  }

  // seems to be the only way to detect key presses
  const KeyboardShortcuts = Extension.create({
    addKeyboardShortcuts() {
      return {
        // Delete the block when backspacing in an empty node
        Backspace: () => {
          if (focused && editor.isEmpty) {
            dispatch('delete');
            editor && editor.destroy();
          }
          return false;
        },
        'Mod-s': () => {
          dispatch('save');
          return true;
        },
        'Mod-l': () => {
          changeLocale()
          return true;
        },
      };
    },
  });

  let focused = false;
  onMount(() => {
    editor = new Editor({
      content,
      element: node,
      extensions: [ 
        StarterKit,
        BubbleMenu.configure({
          element: bubbleMenu,
        }),
        Link.configure({
          HTMLAttributes: {
            class: 'link',
          },
          openOnClick: false
        }),
        Highlight.configure({ multicolor: false }),
        FloatingMenu.configure({
          element: floatingMenu,
        }),
        KeyboardShortcuts,
        Image.configure({
          allowBase64: true
        }),
      ],
      onTransaction() {
        // force re-render so `editor.isActive` works as expected
        editor = editor;
      },
      onUpdate: ({ editor }) => {
        dispatch('debounce');
        return slowDebounce([
          () => {
            dispatch('change', editor.getHTML());
          },
        ]);
      },
      onFocus({ editor, event }) {
        focused = true;
        // dispatch('focus', selection)
      },
      onBlur() {
        //       focusedNode.update(e => ({ ...e, focused: false }))
        focused = false;
        dispatch('blur');
      },
    });
    dispatch('mount');
    editor.chain().focus().run()
  });


  function setLink() {
    modal.show('DIALOG', {
      component: 'LINK',
      onSubmit: (val) => {
        editor.chain().focus().setLink({ href: val }).run();
        modal.hide()
      }
    })
  }

  function addImage() {
    modal.show('DIALOG', {
      component: 'IMAGE',
      onSubmit: ({ url, alt }) => {
        editor.chain().focus().setImage({ src: url, alt }).run();
        modal.hide()
      }
    })
  }

  $: if (node) {
    // classes added manually since they get overwritten by TipTap otherwise
    node.children[0].classList.add('content')
    // node.children[0].classList.add('section-container')
  }

</script>

<div bind:this={node}>
  <div class="menu floating-menu primo-reset" bind:this={floatingMenu}>
    {#if editor}
      <CopyButton
        icon="heading"
        on:click={() => editor
            .chain()
            .focus()
            .toggleHeading({ level: 1 })
            .run()} />
      <CopyButton
        icon="code"
        on:click={() => editor.chain().focus().toggleCodeBlock().run()} />
      <CopyButton
        icon="quote-left"
        on:click={() => editor.chain().focus().toggleBlockquote().run()} />
      <CopyButton
        icon="list-ul"
        on:click={() => editor.chain().focus().toggleBulletList().run()} />
      <CopyButton
        icon="list-ol"
        on:click={() => editor.chain().focus().toggleOrderedList().run()} />
      <CopyButton icon="image" on:click={addImage} />
    {/if}
  </div>
  <div class="menu bubble-menu primo-reset" bind:this={bubbleMenu}>
    {#if editor}
      <CopyButton icon="link" on:click={setLink} />
      <CopyButton
        icon="bold"
        on:click={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')} />
      <CopyButton
        icon="italic"
        on:click={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')} />
      <CopyButton
        icon="highlighter"
        on:click={editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')} />
    {/if}
  </div>
</div>

<style>
  :global(.ProseMirror ::selection, ::-moz-selection) {
    background: var(--primo-color-brand);
  }

  :global(.ProseMirror) {
    caret-color: var(--primo-color-brand);
    white-space: pre-wrap;
    word-wrap: break-word;
    outline: 0;
  }

  .menu {
    font-size: var(--font-size-1);
    display: flex;
    border-radius: var(--input-border-radius);
    margin-left: 0.5rem;
    transition: opacity 0.1s;
    z-index: 99999 !important;
    box-shadow: 0 0 #0000, 0 0 #0000, 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .bubble-menu {
    background-color: var(--color-gray-9);
    color: var(--primo-color-white);
    border-bottom-width: 2px;
    border-color: var(--primo-color-brand);
  }
  .floating-menu {
    transform: translateY(-0.5rem);
    color: var(--color-gray-8);
    background-color: var(--primo-color-white);
  }

</style>