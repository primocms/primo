<script>
  import { onMount, createEventDispatcher, tick } from 'svelte'
  const dispatch = createEventDispatcher()
  import modal from '$lib/editor/stores/app/modal'
  import { hoveredBlock, showingIDE } from '$lib/editor/stores/app/misc'
  import { mouse_position } from '$lib/stores'
  import { draggable } from '@neodrag/svelte'
  import { positions } from '$lib/editor/views/editor/Layout/ComponentNode.svelte'
  import MenuPopup from '$lib/components/MenuPopup.svelte'
  import IconButton from '$lib/components/IconButton.svelte'
  import Block from './BlockItem.svelte'
  import { sections } from '$lib/editor/stores/app/activePage'

  export let symbol
  export let controls_enabled = true

  let coordinates = {
    x: 0,
    y: 0,
  }

  function edit_symbol(symbol) {
    $showingIDE = true
    modal.show('COMPONENT_EDITOR', {
      component: symbol,
      header: {
        title: `Edit ${symbol.title || 'Block'}`,
        icon: 'fas fa-check',
        button: {
          label: `Save Block`,
          icon: 'fas fa-check',
          onclick: (symbol) => {
            dispatch('edit', symbol)
            modal.hide()
          },
        },
        show_switch: false,
      },
    })
  }

  function on_drag(e) {
    dragging = true

    // const block_center = rect.y + rect.height / 2;
    const mouse_y = $mouse_position.y || 0
    const mouse_x = $mouse_position.x || 0

    // determine if block_center is within the range of the positions
    let [matching_block] = $positions.filter((position) => {
      const within_left = mouse_x > position.left
      const above_bottom = mouse_y > position.top
      const below_top = mouse_y < position.bottom
      return within_left && above_bottom && below_top
    })

    if (!matching_block && $positions.length > 0) {
      // hovering below last block
      if (mouse_y > $positions.at(0)['bottom']) {
        matching_block = $positions.at(0)
        dragging_over_block = true
      } else {
        $hoveredBlock = { i: 0, id: null, position: '' }
        dragging_over_block = false
        return
      }
    } else {
      dragging_over_block = true
    }

    const top = matching_block?.top || 0
    const bottom = matching_block?.bottom || 0
    const center = top + (bottom - top) / 2

    if (mouse_y > top && mouse_y < center) {
      // mouse is in top half of block
      $hoveredBlock = {
        ...matching_block,
        position: 'top',
      }
      // set active_hover store with block above and below hover point
      // from block, show dropzone above or below
    } else if (mouse_y > center) {
      // mouse is below bottom half of block
      $hoveredBlock = {
        ...matching_block,
        position: 'bottom',
      }
    } else {
      $hoveredBlock = { i: 0, id: null, position: '' }
    }
  }

  let name_el

  // move cursor to end of name
  $: if (name_el) {
    const range = document.createRange()
    const sel = window.getSelection()
    range.setStart(name_el, 1)
    range.collapse(true)

    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  let renaming = false
  async function toggle_name_input() {
    renaming = !renaming
    // workaround for inability to see cursor when div empty
    if (symbol.name === '') {
      symbol.name = 'Block'
    }
  }

  function changeName(new_name) {
    // window.document.activeElement.blur();
    symbol.name = new_name
    dispatch('edit', symbol)
    renaming = false
  }

  // keep height of symbol to prevent jumping
  let element

  let symbol_element
  let height = null
  let width = null
  let top = null

  function set_dimensions() {
    height = element.offsetHeight + 'px'
    width = element.offsetWidth + 'px'
    const rect = symbol_element.getBoundingClientRect()
    top = rect.top + 'px'
  }

  function reset_dimensions() {
    dragging = false
    $hoveredBlock = { i: 0, id: null, position: '' }
    coordinates = { x: 0, y: 0 }
    height = null
    width = null
    top = null
  }

  let dragging = false
  let dragging_over_block = false

  function on_drag_end() {
    if (dragging_over_block || $sections.length === 0) {
      dispatch('add_to_page')
    }
    reset_dimensions()
  }
</script>

<div bind:this={element} class="sidebar-symbol" style:width style:height>
  <header>
    {#if renaming}
      <div
        bind:this={name_el}
        contenteditable
        autofocus
        class="name"
        on:blur={toggle_name_input}
        on:keydown={(e) => {
          if (e.code === 'Enter') {
            e.preventDefault()
            e.target.blur()
            changeName(e.target.textContent)
          }
        }}
        on:keyup={(e) => {
          // changeName(e.target.textContent);
        }}
      >
        {symbol.name}
      </div>
    {:else}
      <div class="name">
        <h3>{symbol.name}</h3>
      </div>
    {/if}
    {#if controls_enabled}
      <div class="symbol-options">
        <IconButton
          icon="material-symbols:edit-note-sharp"
          on:click={() => edit_symbol(symbol)}
        />
        <IconButton
          icon="material-symbols:code"
          on:click={() => edit_symbol(symbol)}
        />
        <MenuPopup
          icon="carbon:overflow-menu-vertical"
          options={[
            {
              label: 'Duplicate',
              icon: 'bxs:duplicate',
              on_click: () => dispatch('duplicate'),
            },
            {
              label: 'Rename',
              icon: 'ic:baseline-edit',
              on_click: toggle_name_input,
            },
            {
              label: 'Download',
              icon: 'ic:baseline-download',
              on_click: () => dispatch('download'),
            },
            {
              label: 'Delete',
              icon: 'ic:outline-delete',
              on_click: () => dispatch('delete'),
            },
          ]}
        />
      </div>
    {/if}
  </header>
  <div
    bind:this={symbol_element}
    class="symbol"
    class:dragging
    style:width
    style:top
    use:draggable={{ position: coordinates }}
    on:neodrag={on_drag}
    on:neodrag:start={() => {
      console.log('starting')
      dragging = true
      set_dimensions()
    }}
    on:neodrag:end={on_drag_end}
  >
    <Block {symbol} />
  </div>
</div>

<style lang="postcss">
  .sidebar-symbol {
    --IconButton-opacity: 0;
    &:hover:not(.dragging) {
      --IconButton-opacity: 1;
    }

    header {
      background: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
      color: #2d3039;
      font-weight: 600;
      font-size: 12px;
      line-height: 12px;

      .name {
      }

      .symbol-options {
        display: flex;
        align-items: center;
        color: #2d3039;

        :global(svg) {
          height: 1rem;
          width: 1rem;
        }
      }
    }
    .symbol {
      width: 100%;
      border: 1px solid #e3e4e8;
      border-radius: 6px;
      /* overflow: hidden; */
      cursor: grab;
      min-height: 2rem;
      transition: box-shadow 0.2s;

      &.dragging {
        cursor: grabbing;
        box-shadow: 0 0 5px 2px rgba(0, 0, 0, 0.1);
        position: fixed;
        z-index: 999;
      }
    }
  }
  [contenteditable] {
    outline: 0 !important;
  }
</style>
