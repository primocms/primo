<script>
  import { slide } from 'svelte/transition'
  import { createEventDispatcher, getContext } from 'svelte'
  import _ from 'lodash-es'
  import { fade } from 'svelte/transition'
  const dispatch = createEventDispatcher()
  import * as Mousetrap from 'mousetrap'
  import { positions } from './ComponentNode.svelte'
  import ComponentNode from './ComponentNode.svelte'
  import BlockButtons from './BlockButtons.svelte'
  import LockedOverlay from './LockedOverlay.svelte'
  import { hoveredBlock } from '../../../stores/app/misc'
  import { onMobile, saved, showingIDE } from '../../../stores/app/misc'
  import modal from '../../../stores/app/modal'
  import sections from '../../../stores/data/sections'
  import {
    update_section_content,
    symbols,
    updatePreview,
    active_page,
  } from '../../../stores/actions'

  /** @type {boolean} */
  export let locked

  /** @type {import('$lib').Section} */
  export let block

  /** @type {number} */
  export let i

  let node

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

  async function delete_block() {
    $positions = $positions.filter((position) => position.id !== block.id)
    await active_page.delete_block(block)
    updatePreview()
  }

  function duplicate_block() {
    active_page.duplicate_block(block, i + 1)
  }

  function edit_component(showIDE = false) {
    dispatch('lock')
    $showingIDE = showIDE
    modal.show(
      'COMPONENT_EDITOR',
      {
        component: block,
        header: {
          title: `Edit ${block.symbol.name || 'Block'}`,
          icon: $showingIDE ? 'fas fa-code' : 'fas fa-edit',
          onclose: () => {
            dispatch('unlock')
          },
          button: {
            icon: 'fas fa-check',
            label: 'Save',
            onclick: async (component) => {
              dispatch('unlock')
              update_section_content(component, component.content)
              symbols.update(component.symbol)
              modal.hide()
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
    Mousetrap.bind('mod+e', edit_component, 'keydown')
  }

  function unbindEdit() {
    Mousetrap.unbind('mod+e')
  }

  $: if (!import.meta.env.SSR && hovering) bindEdit()
  else if (!import.meta.env.SSR) unbindEdit()

  function hover_block(el) {
    // el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  $: if (node) {
    node.addEventListener('mouseleave', () => {
      hovering = false
    })
  }
</script>

{#if $hoveredBlock.active && $hoveredBlock.i === i && $hoveredBlock.position === 'top'}
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
  data-block={block.symbol.id}
  id="block-{block.id}"
  on:mouseenter={() => (hovering = true)}
  on:mouseleave={() => (hovering = false)}
>
  {#if locked || hovering || $onMobile}
    <div bind:this={container} class="block-buttons-container">
      {#if locked}
        <LockedOverlay {locked} />
      {:else}
        <BlockButtons
          {block}
          {i}
          bind:node={buttons}
          on:delete={delete_block}
          on:duplicate={duplicate_block}
          on:edit-code={() => edit_component(true)}
          on:edit-content={() => edit_component()}
          optionsAbove={hasOptionsAbove(i, $sections)}
          optionsBelow={hasOptionsBelow(i, $sections)}
          on:moveUp={() => active_page.move_block(block, i - 1)}
          on:moveDown={() => active_page.move_block(block, i + 1)}
        />{/if}
    </div>
  {/if}
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
</div>

{#if $hoveredBlock.active && $hoveredBlock.i === i && $hoveredBlock.position === 'bottom'}
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
