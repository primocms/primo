<!-- <svelte:options tag='block-buttons' /> -->
<script>
  import Mousetrap from 'mousetrap';

  import { code, trash, edit } from '../../../components/svg/small';

  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { content } from '../../../stores/app/activePage';
  import { switchEnabled } from '../../../stores/app';

  let modKeydown = false;
  Mousetrap.bind(
    'mod',
    () => {
      modKeydown = true;
    },
    'keydown'
  );
  Mousetrap.bind(
    'mod',
    () => {
      modKeydown = false;
    },
    'keyup'
  );
  Mousetrap.bind(
    'mod+e',
    () => {
      dispatch('edit');
    },
    'keydown'
  );
  const dispatch = createEventDispatcher();

  export let i;
  export let optionsAbove;
  export let optionsBelow;
  export let node = null;

  export let editable;

  const iconStyles = `width:15px;position: relative;top: 1px;fill:#f7fafc;`;

  $: isFirst = i === 0;
  $: isLast = i === $content.length - 1;

</script>

<div
  in:fade={{ duration: 100 }}
  class="block-buttons"
  class:editable
  class:is-content={!editable}
  bind:this={node}>
  <div class="top">
    <div class="component-button">
      {#if editable}
        <button on:click={() => dispatch('edit')} class="button-span">
          {#if modKeydown}
            <span>&#8984; E</span>
          {:else}
            {#if $switchEnabled}
              {@html code(iconStyles)}
            {:else}
              {@html edit(iconStyles)}
            {/if}
            <span>Edit</span>
          {/if}
        </button>
      {/if}
      <button on:click={() => dispatch('delete')} class="button-delete">
        {@html trash(`${iconStyles}`)}
      </button>
    </div>
    <div class="component-svg">
      {#if !isFirst}
        <button class="top-right" on:click={() => dispatch('moveUp')}>
          <svg
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"><path
              fill-rule="evenodd"
              d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
              clip-rule="evenodd" /></svg>
        </button>
      {/if}
      {#if !optionsAbove}
        <button
          class="top-right"
          on:click={() => dispatch('addOptionsAbove')}
          class:rounded-bl={isFirst}>
          <svg
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"><path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
              clip-rule="evenodd" /></svg>
        </button>
      {/if}
    </div>
  </div>
  <div class="bottom">
    {#if !isLast}
      <button class="bottom-right" on:click={() => dispatch('moveDown')}>
        <svg
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"><path
            fill-rule="evenodd"
            d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
            clip-rule="evenodd" /></svg>
      </button>
    {/if}
    {#if !optionsBelow}
      <button
        class="bottom-right"
        on:click={() => dispatch('addOptionsBelow')}
        class:rounded-tl={isLast}>
        <svg
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"><path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
            clip-rule="evenodd" /></svg>
      </button>
    {/if}
  </div>
</div>

<style lang="postcss">
  .block-buttons {
    box-shadow: inset 0 0 0 calc(4px) rgb(248, 68, 73);
    z-index: 10;
    position: absolute;
    pointer-events: none;
    inset: 0px;
  }

  .is-content {
    box-shadow: inset 0 0 0 calc(4px) rgba(248, 68, 73, 0.1);
  }
  .component-button {
    display: flex;
    left: 0px;
  }
  .button-delete {
    border-bottom-right-radius: 0.25rem;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
  .button-span {
    border-right-width: 1px;
    border-color: rgba(239, 68, 68, var(--tw-border-opacity));
    padding-left: 0.5rem /* 8px */;
    padding-right: 0.5rem /* 8px */;
  }

  button {
    padding: 0 1rem;
    pointer-events: all;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 2rem;
    background-color: var(--color-primored);
    color: var(--color-white);
    font-size: var(--font-size-2);
    font-weight: 500;
    transition: background-color 0.1s, color 0.1s;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), 0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);

    svg {
      height: 1.25rem;
      width: 1.25rem;
    }

    &:hover {
      background-color: var(--color-primored-dark);
    }

    &.top-right:first-child {
      border-bottom-left-radius: 0.25rem;
    }

    &.bottom-right:first-child {
      border-top-left-radius: 0.25rem;

      svg {
        transform: rotate(180deg);
      }
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
    width: 100%;
    inset: 0px;
  }
  .component-svg {
    display: flex;
    position: absolute;
    right: 0px;
  }
  .button-moveup-down {
    border-bottom-left-radius: 0.25rem;
    border-right-width: 1px;
    border-color: rgba(239, 68, 68, var(--tw-border-opacity));
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
  .bottom {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    bottom: 0px;
    right: 0px;
    position: absolute;
  }
  span {
    margin-left: 0.5rem /* 8px */;
  }

</style>
