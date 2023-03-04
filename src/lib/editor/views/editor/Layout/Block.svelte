<script>
  import { slide } from 'svelte/transition'
  import { tick, createEventDispatcher, onDestroy, getContext } from 'svelte'
  import _ from 'lodash-es'
  import { fade } from 'svelte/transition'
  const dispatch = createEventDispatcher()
  import * as Mousetrap from 'mousetrap'
  import { positions } from './ComponentNode.svelte'
  import { createUniqueID, move } from '../../../utilities'
  import { getComponentData } from '../../../stores/helpers'
  import ComponentNode from './ComponentNode.svelte'
  import BlockButtons from './BlockButtons.svelte'
  import LockedOverlay from './LockedOverlay.svelte'
  import { hoveredBlock } from '../../../stores/app/misc'
  import { onMobile, saved, showingIDE } from '../../../stores/app/misc'
  import modal from '../../../stores/app/modal'
  import { id, sections } from '../../../stores/app/activePage'
  import {
    pages,
    updateContent,
    update_symbol_with_static_values,
    symbols,
    updatePreview,
    deleteSection,
  } from '../../../stores/actions'

  export let locked
  export let block
  export let i

  let node
  $: if (node) {
    // get top and bottom positions of node
  }

  function hasOptionsAbove(rowIndex, rows) {
    const rowAbove = rows[rowIndex - 1]
    if (rowAbove && rowAbove.type === 'options') {
      return true
    } else return false
  }

  function hasOptionsBelow(rowIndex, rows) {
    const rowBelow = rows[rowIndex + 1]
    if (rowBelow && rowBelow.type === 'options') {
      return true
    } else return false
  }

  function deleteBlock() {
    $positions = $positions.filter((position) => position.id !== block.id)
    deleteSection(block.id)
    updatePreview()
  }

  function updateSections(newSections) {
    pages.update($id, (page) => ({
      ...page,
      sections: newSections,
    }))
    updatePreview()
    $saved = false
  }

  function insertOptionsRow(i, position) {
    hovering = false
    modal.show(
      'SYMBOL_LIBRARY',
      {
        onselect: (component) => {
          modal.hide()
          if (position === 'above') {
            updateSections([
              ...$sections.slice(0, i),
              component,
              ...$sections.slice(i),
            ])
          } else {
            updateSections([
              ...$sections.slice(0, i + 1),
              component,
              ...$sections.slice(i + 1),
            ])
          }
        },
      },
      {
        hideLocaleSelector: true,
      }
    )
  }

  function moveBlock(i, direction) {
    if (direction === 'up') {
      updateSections(move($sections, i, i - 1))
    } else {
      updateSections(move($sections, i, i + 1))
    }
  }

  function duplicateBlock() {
    const newBlock = _.cloneDeep(block)
    newBlock.id = createUniqueID()

    const componentData = getComponentData({ component: block })

    updateContent(newBlock.id, componentData)
    updateSections([
      ...$sections.slice(0, i + 1),
      newBlock,
      ...$sections.slice(i + 1),
    ])
  }

  function editComponent(showIDE = false) {
    dispatch('lock')
    $showingIDE = showIDE
    modal.show(
      'COMPONENT_EDITOR',
      {
        component: block,
        header: {
          title: `Edit ${block.name || 'Block'}`,
          icon: $showingIDE ? 'fas fa-code' : 'fas fa-edit',
          onclose: () => {
            dispatch('unlock')
          },
          button: {
            icon: 'fas fa-check',
            label: 'Save',
            onclick: (component) => {
              dispatch('unlock')
              symbols.update({
                type: 'symbol',
                id: component.symbolID,
                code: component.code,
                fields: component.fields,
              })
              Object.entries(component.content).forEach((field) => {
                const [localeID, localeContent] = field
                if (localeContent)
                  updateContent(component.id, localeContent, localeID)
              })
              update_symbol_with_static_values(component)
              modal.hide()
              updatePreview()
            },
          },
        },
      },
      {
        showSwitch: true,
      }
    )
  }

  let buttons
  let hovering = false
  $: if (!hovering && sticky) {
    sticky = false
  }
  let sticky = false
  let toolbarHeight = 0
  let constrainButtons = getContext('SIMPLE')

  let container
  let toolbar

  // position block buttons below toolbar
  $: if (!import.meta.env.SSR && container && hovering && !constrainButtons) {
    toolbar = document.querySelector('#primo-toolbar')
    document.querySelector('#page')?.addEventListener('scroll', positionBlock)
    positionBlock()
  } else if (!import.meta.env.SSR && !hovering && !constrainButtons) {
    document
      .querySelector('#page')
      ?.removeEventListener('scroll', positionBlock)
  }

  let mounted = false
  if (block.type === 'content') {
    // delay mount to line up with components
    setTimeout(() => {
      mounted = true
    }, 1000)
  } else if (block.type !== 'component') {
    mounted = true
  }

  async function positionBlock() {
    // await tick()
    if (!node || !container || !hovering) return
    toolbarHeight = toolbar ? toolbar.clientHeight : 0
    const { top } = node.getBoundingClientRect()
    const { top: parentTop, bottom: parentBottom } =
      container.getBoundingClientRect()
    const topButtons = buttons.children[0]

    const shouldSticky = top < toolbarHeight && hovering
    const outOfView = parentBottom <= toolbarHeight
    const belowToolbar = parentTop > toolbarHeight || (!hovering && sticky)

    if (shouldSticky) {
      // not yet sticky, top is above the toolbar
      stickyButtons(topButtons)
    } else if (belowToolbar || outOfView) {
      // currently sticky, top is below toolbar
      resetButtons(topButtons)
    }

    if (node.style.position === 'fixed') {
      sticky = true
    } else {
      sticky = false
    }

    function stickyButtons(node) {
      const rect = node.getBoundingClientRect()
      node.style.position = 'fixed'
      node.style.left = `${rect.left}px`
      // node.style.right = `${rect.left + rect.width}px`
      node.style.top = `${toolbarHeight}px` // toolbarHeight missing 8px for some reason
    }

    function resetButtons(node) {
      node.style.position = 'absolute'
      node.style.top = '0px'
      node.style.left = '0px'
      node.style.right = `0px`
      sticky = false
    }
  }

  function bindEdit() {
    Mousetrap.bind('mod+e', editComponent, 'keydown')
  }

  function unbindEdit() {
    Mousetrap.unbind('mod+e')
  }

  $: if (!import.meta.env.SSR && hovering) bindEdit()
  else if (!import.meta.env.SSR) unbindEdit()

  function hover_block(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  $: if (node) {
    node.addEventListener('mouseleave', () => {
      hovering = false
    })
  }
</script>

{#if $hoveredBlock.i === i && $hoveredBlock.position === 'top'}
  <div
    use:hover_block
    transition:slide={{ duration: 100 }}
    class="hover-state"
  />
{/if}

<div
  bind:this={node}
  in:fade={{ duration: 100 }}
  class:locked
  data-block={block.symbolID}
  id={block.id}
  on:mouseenter={() => (hovering = true)}
  on:mouseleave={() => (hovering = false)}
>
  {#if locked || hovering || $onMobile}
    <div bind:this={container} class="block-buttons-container">
      {#if locked}
        <LockedOverlay />
      {:else}
        <BlockButtons
          {i}
          editable={block.type === 'component'}
          bind:node={buttons}
          on:delete={() => {
            deleteBlock()
            dispatch('contentChanged')
          }}
          on:duplicate={() => {
            duplicateBlock()
            dispatch('contentChanged')
          }}
          on:edit-code={() => editComponent(true)}
          on:edit-content={() => editComponent()}
          optionsAbove={hasOptionsAbove(i, $sections)}
          optionsBelow={hasOptionsBelow(i, $sections)}
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
        />{/if}
    </div>
  {/if}
  {#if block.type === 'component'}
    <ComponentNode
      {i}
      {block}
      on:lock
      on:unlock
      on:mount={() => {
        mounted = true
        dispatch('mount')
      }}
    />
  {/if}
</div>

{#if $hoveredBlock.i === i && $hoveredBlock.position === 'bottom'}
  <div
    use:hover_block
    transition:slide={{ duration: 100 }}
    class="hover-state"
  />
{/if}

<style lang="postcss">
  [data-block] {
    position: relative;
    min-height: 3rem;
    transition: 0.1s;
    &.locked {
      pointer-events: none;
    }
  }
  .hover-state {
    height: 10px;
    width: 100%;
    background: var(--primo-color-brand);
  }
  .block-buttons-container {
    position: absolute;
    inset: 0;
    height: 100%;

    z-index: 999;
    /* opacity: 0; */
    transition: 0.1s opacity;
    /* pointer-events: none; */
    pointer-events: none;

    /* &.visible {
      opacity: 1;

      :global(button) {
        pointer-events: all;
      }
    } */
  }
</style>
