<script>
  import {onMount,createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()
  import {createEditor} from '../../../libraries/prosemirror/prosemirror.js'
  import {focusedNode} from '../../../stores/app'
  import BlockButtons from './BlockButtons.svelte'
  export let block
  let editor
  let prosemirror
  onMount(() => {
    prosemirror = createEditor({ mount: editor }, block.value.html, {
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

<div class="primo-copy mousetrap" id="copy-{block.id}" bind:this={editor}>
  <BlockButtons />
</div>

<style global>
  .primo-copy {
    outline: none;
    caret-color: rgb(248,68,73);
  }
  .ProseMirror {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>