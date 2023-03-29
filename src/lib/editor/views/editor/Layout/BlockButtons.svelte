<script>
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import sections from '../../../stores/data/sections'
  import Icon from '@iconify/svelte'
  import { showingIDE } from '../../../stores/app/misc'

  const dispatch = createEventDispatcher()

  export let i
  export let node = null

  $: isFirst = i === 0
  $: isLast = i === $sections.length - 1
</script>

<div
  in:fade={{ duration: 100 }}
  class="block-buttons primo-reset"
  bind:this={node}
>
  <div class="top">
    <div class="component-button">
      <button on:click={() => dispatch('edit-content')}>
        <Icon icon="material-symbols:edit-square-outline-rounded" />
      </button>
      <button on:click={() => dispatch('edit-code')}>
        <Icon icon="ph:code-bold" />
      </button>
    </div>
    <div class="top-right">
      <button on:click={() => dispatch('delete')} class="button-delete">
        <Icon icon="ion:trash" />
      </button>
      <button on:click={() => dispatch('duplicate')}>
        <Icon icon="ion:duplicate" />
      </button>
      {#if !isFirst}
        <button on:click={() => dispatch('moveUp')}>
          <Icon icon="heroicons-outline:chevron-up" />
        </button>
      {/if}
    </div>
  </div>
  <div class="bottom">
    {#if !isLast}
      <button class="bottom-right" on:click={() => dispatch('moveDown')}>
        <Icon icon="heroicons-outline:chevron-down" />
      </button>
    {/if}
  </div>
</div>

<style lang="postcss">
  .block-buttons {
    box-shadow: inset 0 0 0 calc(4px) var(--color-gray-8);
    z-index: 999999;
    position: absolute;
    inset: 0px;
  }
  .component-button {
    display: flex;
    left: 0px;

    button:last-child {
      border-bottom-right-radius: 0.25rem;
    }
  }

  .top-right {
    display: flex;
  }

  .button-delete {
    /* border-left: 1px solid var(--primo-color-brand-dark); */
    border-bottom-left-radius: 0.25rem;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  button {
    pointer-events: all;
    padding: 0 1rem;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 2rem;
    background-color: var(--primo-color-black-opaque);
    color: var(--primo-color-white);
    font-size: var(--font-size-2);
    font-weight: 500;
    transition: background-color 0.1s, color 0.1s;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), 0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);

    &:hover {
      z-index: 1; /* show full shadow */
      /* box-shadow: var(--primo-ring-primogreen); */
      background: var(--primo-color-brand);
      color: var(--colr-gray-9);
    }
  }
  button:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
  }

  .top {
    display: flex;
    justify-content: space-between;
    position: absolute;
    /* width: 100%; */
    inset: 0px;
  }
  .bottom {
    display: flex;
    justify-content: flex-end;
    /* width: 100%; */
    bottom: 0px;
    right: 0px;
    position: absolute;
  }
</style>
