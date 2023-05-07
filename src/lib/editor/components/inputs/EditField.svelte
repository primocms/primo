<script>
  import { draggable } from '@neodrag/svelte'
  import MenuPopup from '$lib/components/MenuPopup.svelte'
  import { createEventDispatcher } from 'svelte'

  export let level
  export let child = false
  export let minimal = false
  export let showVisibilityOptions = false
  export let top_level = true
  export let has_subfields = false

  let coordinates = {
    x: 0,
    y: 0,
  }

  const dispatch = createEventDispatcher()

  function moveItem(direction) {
    dispatch('move', direction)
  }

  let width
  $: collapsed = width < 560

  let height = null
  let top = null

  let dragging = false
  let dragging_over_block = false

  function on_drag_end() {}

  function set_dimensions() {}

  function reset_dimensions() {
    // dragging = false
  }

  function on_drag(e) {
    dragging = true

    // // const block_center = rect.y + rect.height / 2;
    // const mouse_y = $mouse_position.y || 0
    // const mouse_x = $mouse_position.x || 0
  }
</script>

<div class="top-container" class:top_level>
  <div
    class="field-container"
    class:has-visibility-options={showVisibilityOptions}
    class:child
    class:minimal
    class:collapsed
    bind:clientWidth={width}
  >
    <div class="top-left">
      <!-- <button
        on:neodrag={on_drag}
        on:neodrag:start={() => {
          dragging = true
          set_dimensions()
        }}
        on:neodrag:end={on_drag_end}
      >
        <Icon icon="material-symbols:drag-handle-rounded" />
      </button> -->
    </div>

    <label class="type">
      <span>Type</span>
      <slot name="type" />
    </label>
    {#if minimal}
      <label class="main">
        <span>Information</span>
        <slot name="main" />
      </label>
    {:else}
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="label">
        <span>Label</span>
        <slot name="label" />
      </label>
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <div class="field">
        <label>
          <span>Key</span>
          <slot name="key" />
        </label>
      </div>
      <!-- {#if showVisibilityOptions}
        <label class="hide">
          <span>Visible</span>
          <slot name="hide" />
        </label>
      {/if} -->
    {/if}
    {#if top_level && !minimal}
      <div class="toggle">
        <slot name="toggle" />
      </div>
    {/if}

    <div class="top-right" class:subfield={!top_level}>
      <MenuPopup
        icon="carbon:overflow-menu-vertical"
        options={[
          // {
          //   label: 'Download',
          //   icon: 'ic:baseline-download',
          //   on_click: () => dispatch('download'),
          // },
          {
            label: 'Move up',
            icon: 'material-symbols:arrow-circle-up-outline',
            on_click: () => dispatch('move', 'up'),
          },
          {
            label: 'Move down',
            icon: 'material-symbols:arrow-circle-down-outline',
            on_click: () => dispatch('move', 'down'),
          },
          {
            label: 'Duplicate',
            icon: 'bxs:duplicate',
            on_click: () => dispatch('duplicate'),
          },
          {
            label: 'Delete',
            icon: 'ic:outline-delete',
            on_click: () => dispatch('delete'),
          },
        ]}
      />
    </div>
  </div>
  {#if has_subfields}
    <div class="children-container" style:padding-left="{level + 1}rem">
      <slot />
    </div>
  {/if}
</div>

<style lang="postcss">
  .top-container {
    display: grid;
    gap: 1rem;
    position: relative;

    &.top_level {
      background-color: #1a1a1a;
      border-radius: 6px;
      padding: 24px 24px;
    }
  }

  .top-left {
    position: absolute;
    top: -1rem;
    left: -1.25rem;
  }

  .top-right {
    position: absolute;
    top: -1rem;
    right: -1.25rem;

    &.subfield {
      top: 50%;
    }
  }

  .children-container {
    display: grid;
    gap: 1rem;
    margin: 1rem 0;
    border-color: var(--color-gray-8);
  }

  .field-container {
    display: grid;
    grid-template-columns: 110px 1fr 1fr auto;
    gap: 1rem;
    place-items: start normal;

    &.collapsed {
      grid-template-columns: 2fr 2fr !important;

      .subfield {
        position: static;
        grid-column: 2;
        grid-row: 1;
        margin-top: 1rem;
        margin-left: auto;
      }

      .label {
        grid-column: 1;
      }

      .field {
        grid-column: 2;
      }

      .toggle {
        grid-column: 2;
        grid-row: 1;
      }
    }

    &.collapsed.minimal {
      .main {
        grid-column: 1 / span 2;
      }
    }

    &.has-visibility-options {
      grid-template-columns: auto 1fr 1fr minmax(4rem, auto) auto;
    }

    &.child {
      margin-left: 1rem;
      padding: 0.25rem 0.5rem;
    }

    .type {
      border-radius: 1px;
      display: flex;
      min-width: 3rem;
    }

    label {
      display: flex;
      flex-direction: column;
      flex: 1;

      span {
        font-size: var(--font-size-1);
        padding-bottom: 0.25rem;
        color: #9d9d9d;
      }
    }

    &.minimal {
      grid-template-columns: auto 1fr auto;
    }
  }
  span {
    color: var(--color-gray-3);
  }
</style>
