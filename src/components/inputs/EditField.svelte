<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import _ from 'lodash';

  export let child = false;
  export let disabled = false;
  export let isFirst = false;
  export let isLast = false;
  export let minimal = false;

  const dispatch = createEventDispatcher();

  function moveItem(direction) {
    dispatch('move', direction);
  }

</script>

<div
  class="field-container"
  in:fade={{ duration: 100 }}
  class:child
  class:minimal>
  <div class="type">
    <slot name="type" />
  </div>
  {#if minimal}
    <slot name="main" />
  {:else}
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label>
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
  {/if}
  <div class="option-buttons">
    <button disabled={isFirst} title="Move up" on:click={() => moveItem('up')}>
      <i class="fas fa-arrow-up" />
    </button>
    <button
      disabled={isLast}
      title="Move down"
      on:click={() => moveItem('down')}>
      <i class="fas fa-arrow-down" />
    </button>
    <button on:click={() => dispatch('delete')} {disabled} title="delete field">
      <i class="fas fa-trash" />
    </button>
  </div>
</div>

<style lang="postcss">
  .field-container {
    display: grid;
    grid-template-columns: auto 1fr 1fr auto;
    padding: 0.5rem;
    gap: 1rem;

    &.child {
      margin-left: 1rem;
      padding: 0.25rem 0.5rem;
      .type {
        select {
          padding: 4px 8px;
        }
      }

      label {
        input {
          padding: 1px 4px;
        }
      }
    }

    .type {
      border-radius: 1px;
      display: flex;
      align-items: center;
      min-width: 3rem;
    }

    label {
      display: flex;
      flex-direction: column;
      flex: 1;

      span {
        font-weight: 600;
        font-size: var(--font-size-1);
        padding-bottom: 2px;
      }
    }

    .option-buttons {
      padding: 0.25rem 0.5rem;
      color: var(--color-gray-3);
      background: var(--color-gray-900);
      z-index: 10;
      border-radius: var(--border-radius-1);
      display: flex;
      align-items: center;
      justify-content: flex-end;

      button {
        border-radius: 1px;
        transition: color 0.1s;
        &:hover,
        &:focus {
          color: var(--color-gray-4);
        }
        &:first-child {
          margin-right: 0.25rem;
        }

        &:last-child {
          margin-left: 0.5rem;
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
