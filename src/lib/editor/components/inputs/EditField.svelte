<script>
  import { createEventDispatcher } from 'svelte'

  export let level
  export let child = false
  export let minimal = false
  export let showVisibilityOptions = false
  export let top_level = true

  const dispatch = createEventDispatcher()

  function moveItem(direction) {
    dispatch('move', direction)
  }

  let width
  $: collapsed = width < 560
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
    <label class="type">
      <span>Type</span>
      <slot name="type" />
    </label>
    {#if minimal}
      <div class="main">
        <slot name="main" />
      </div>
    {:else}
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label class="label">
        <span>Label</span>
        <slot name="label" />
      </label>
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <div class="field">
        <label>
          <span>ID</span>
          <slot name="key" />
        </label>
      </div>
      {#if showVisibilityOptions}
        <label class="hide">
          <span>Visible</span>
          <slot name="hide" />
        </label>
      {/if}
    {/if}
    {#if top_level && !minimal}
      <div class="toggle">
        <slot name="toggle" />
      </div>
    {/if}
  </div>
  {#if $$slots}
    <div class="children-container" style:padding-left="{level + 1}rem">
      <slot />
    </div>
  {/if}
</div>

<style lang="postcss">
  .top-container {
    display: grid;
    gap: 1rem;

    &.top_level {
      border: 1px solid #333333;
      border-radius: 6px;
      padding: 20px 24px;
    }
  }

  .field-container {
    display: grid;
    grid-template-columns: 110px 1fr 1fr auto;
    gap: 1rem;

    &.collapsed {
      grid-template-columns: 2fr 2fr !important;

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
      }
    }

    .option-buttons {
      /* padding: 0.25rem 0.5rem; */
      color: var(--color-gray-3);
      background: var(--color-gray-900);
      z-index: 10;
      border-radius: var(--primo-border-radius);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      padding-top: 22px;

      button {
        border-radius: 1px;
        transition: color 0.1s;
        &:not(disabled):hover,
        &:not(disabled):focus {
          color: var(--color-gray-4);
        }

        &:last-child {
          color: var(--color-gray-5);
        }
      }
    }

    &.minimal {
      grid-template-columns: auto 1fr auto;
    }
  }

  button[disabled] {
    color: var(--color-gray-7);
    cursor: default;
  }
  span {
    color: var(--color-gray-3);
  }
</style>
