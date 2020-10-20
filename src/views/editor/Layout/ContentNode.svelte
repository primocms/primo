<script lang="ts">
  import {onMount,createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  import {fade} from 'svelte/transition'

  import {createEditor} from '../../../libraries/prosemirror/prosemirror.js'
  import {focusedNode} from '../../../stores/app'
  import type {Content} from './LayoutTypes'

  export let row:Content

  let editor
  let prosemirror

  onMount(() => {
    prosemirror = createEditor({ mount: editor }, row.value.html, {
      onchange: (html) => {
        dispatch('change',editor.innerHTML)
      },
      onselectionchange: (selection) => {
        dispatch('selectionChange', selection)
      },
      onfocus: (selection) => {
        dispatch('focus', selection)
      },
      onblur: () => {
        focusedNode.update(e => ({ ...e, focused: false }))
        dispatch('blur')
      },
      onkeydown: (e) => {},
      ondelete: (html) => {
        dispatch('change',html)
        dispatch('delete')
      }
    })
    prosemirror.view.focus()
  })

</script>

<div class="primo-content mousetrap" bind:this={editor} id="content-{row.id}"></div>

<style global>
  .primo-content {
    outline: none;
    caret-color: rgb(248,68,73);
  }
  .primo-content li p {
    display: inline-block;
  }
  .ProseMirror {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>