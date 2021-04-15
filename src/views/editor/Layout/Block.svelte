<script lang="ts">
  import _ from 'lodash'
  import { tick, createEventDispatcher } from 'svelte'
  import {fade} from 'svelte/transition'
  const dispatch = createEventDispatcher()

  import { createUniqueID, move } from '../../../utilities'
  import type { Block } from './LayoutTypes'
  import OptionsButtons from './OptionsButtons.svelte'
  import ContentNode from './ContentNode.svelte'
  import ComponentNode from './ComponentNode.svelte'
  import BlockButtons from './BlockButtons.svelte'
  import { createDebouncer } from '../../../utils'
  const slowDebounce = createDebouncer(2000)

  import { focusedNode } from '../../../stores/app'
  import modal from '../../../stores/app/modal'
  import {id, content} from '../../../stores/app/activePage'
  import {pages} from '../../../stores/actions'

  export let block: Block
  export let i

  function hasOptionsAbove(rowIndex: number, rows: Array<Block>): boolean {
    const rowAbove: Block = rows[rowIndex - 1]
    if (rowAbove && rowAbove.type === 'options') {
      return true
    } else return false
  }

  function hasOptionsBelow(rowIndex: number, rows: Array<Block>): boolean {
    const rowBelow: Block = rows[rowIndex + 1]
    if (rowBelow && rowBelow.type === 'options') {
      return true
    } else return false
  }

  function checkIfOnlyChild(): boolean {
    return $content.length <= 1
  }

  function deleteRow() {
    const onlyChild = $content.length <= 1
    if (onlyChild) {
      updateBlock(OptionsRow())
    } else {
      updateBlock(null)
    }
  }

  function updateBlock(newBlock) {
    $content = $content.map((existingRow) => {
      if (existingRow.id === block.id) {
        return newBlock
      } else return existingRow
    }).filter(Boolean)
    updateContent(
      $content
    )
  }

  function updateContent(newContent) {
    pages.update($id, (page) => ({
      ...page,
      content: newContent
    }))
  }

  // Constructors
  function ContentRow() {
    return {
      id: createUniqueID(),
      type: 'content',
      value: {
        html: '',
      },
    }
  }

  function OptionsRow() {
    return {
      id: createUniqueID(),
      type: 'options',
    }
  }

  function insertOptionsRow(i, position) {
    hovering = false
    if (position === 'above') {
      updateContent([...$content.slice(0, i), OptionsRow(), ...$content.slice(i)])
    } else {
      updateContent([...$content.slice(0, i + 1), OptionsRow(), ...$content.slice(i + 1)])
    }
  }

  function moveBlock(i, direction) {
    if (direction === 'up') {
      updateContent(move($content, i, i-1))
    } else {
      updateContent(move($content, i, i+1))
    }
  }

  async function selectOption(option) {
    if (option === 'component') {
      modal.show('COMPONENT_EDITOR', {
        header: {
          title: 'Create Component',
          icon: 'fas fa-code',
          button: {
            icon: 'fas fa-plus',
            label: 'Add to page',
            onclick: (component) => {
              updateBlock(component)
              modal.hide()
            },
          },
        },
      })
    } else if (option === 'symbol') {
      modal.show('SYMBOL_LIBRARY', {
        button: {
          onclick: (component) => {
            updateBlock(component)
            modal.hide()
          },
        },
      })
    } else if (option === 'content') {
      updateBlock(ContentRow())
    } else {
      console.error('No option set for ', option)
    }
  }     

  function editComponent() {
    modal.show('COMPONENT_EDITOR', {
      component: block,
      header: {
        title: 'Edit Component',
        icon: 'fas fa-code',
        button: {
          icon: 'fas fa-check',
          label: 'Draft',
          onclick: (component) => {
            updateBlock(component)
            modal.hide()
          },
        },
      },
    })
  }       


  let buttons 
  let hovering = false
  $: if (!hovering && sticky) {
    sticky = false;
  } 
  let sticky = false
  const toolbarHeight = 56

  function blockContainer(container, hovering) {
    const node = container.children[0]
    window.addEventListener('scroll', positionBlock)
    if (hovering) {
      positionBlock()
    }

    function positionBlock() {
      const { top } = node.getBoundingClientRect();
      const { top:parentTop, bottom:parentBottom } = container.getBoundingClientRect();
      const topButtons = node.querySelector('.top')

      const shouldSticky = !sticky && top < toolbarHeight && hovering
      const outOfView = parentBottom <= toolbarHeight
      const belowToolbar = parentTop > toolbarHeight || !hovering && sticky

      if (shouldSticky) {  // not yet sticky, top is above the toolbar
        stickyButtons(topButtons)
      } else if (belowToolbar || outOfView) { // currently sticky, top is below toolbar
        resetButtons(topButtons)
      } 
    }

    function stickyButtons(node) {
      node.style.position = 'fixed'
      node.style.top = `${toolbarHeight}px`
      sticky = true
    }

    function resetButtons(node) {
      node.style.position = 'absolute'
      node.style.top = '0px'
      sticky = false
    }

    return {
      destroy() {
        window.removeEventListener('scroll', positionBlock)
      }
    }

  }    

</script>

<div in:fade={{ duration: 200 }} class="block" class:z-50={block.type === 'options'} id="block-{block.id}" on:mouseenter={() => hovering = true} on:mouseleave={() => hovering = false}>
  {#if hovering && block.type !== 'options'}
    <div class="block-buttons-container" use:blockContainer={hovering}>
      <BlockButtons 
        {i}
        editable={block.type === 'component'} 
        bind:node={buttons} 
        on:delete={() => {
          deleteRow()
          dispatch('contentChanged')
        }}
        on:edit={editComponent}
        optionsAbove={hasOptionsAbove(i, $content)}
        optionsBelow={hasOptionsBelow(i, $content)}
        on:moveUp={() => {
          moveBlock(i, 'up')
          dispatch('contentChanged')
        }}
        on:moveDown={() => {
          moveBlock(i, 'down')
          dispatch('contentChanged')
        }}
        on:addOptionsAbove={() => {
          insertOptionsRow(i, 'above')
          dispatch('contentChanged')
        }}
        on:addOptionsBelow={() => {
          insertOptionsRow(i, 'below')
          dispatch('contentChanged')
        }}
      />
    </div>
  {/if}
  {#if block.type === 'component'}
    <ComponentNode {block} />
  {:else if block.type === 'content'}
    <ContentNode
      {block}
      on:focus={({ detail: selection }) => {
        focusedNode.setSelection({
          id: block.id,
          position: i,
          selection,
          // path: { section, column, block },
        })
      }}
      on:change={({ detail: html }) => slowDebounce([() => {
        updateBlock({
          ...block,
          value: { html }
        })
        dispatch('contentChanged')
      }])}
      on:selectionChange={({ detail: selection }) => {
        focusedNode.setSelection({
          id: block.id,
          position: i,
          selection,
        })
      }}
      on:delete={deleteRow}
    />
  {:else if block.type === 'options'}
    <OptionsButtons
      deletable={!checkIfOnlyChild(block.id)}
      on:convert={({ detail: type }) => selectOption(type)}
      on:remove={deleteRow}
    />
  {/if}
</div>

<style>
  .block {
    @apply relative;

    .block-buttons-container {
      @apply pointer-events-none absolute top-0 left-0 right-0 bottom-0 z-30;
    }
  }
</style>
