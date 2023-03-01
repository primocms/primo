<script>
  // import Letter from '$lib/components/Letter.svelte';
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import Icon from '@iconify/svelte'

  const dispatch = createEventDispatcher()
</script>

<div class="locked-overlay primo-reset" transition:fade={{ duration: 200 }}>
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
      <div class="lock">
        <div>
          <Icon icon="carbon:locked" />
          <span>Locked</span>
        </div>
        <!-- <Letter letter="m" /> -->
      </div>
    </div>
  </div>
  <div class="bottom">
    <button class="bottom-right" on:click={() => dispatch('moveDown')}>
      <svg
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        ><path
          fill-rule="evenodd"
          d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
          clip-rule="evenodd"
        /></svg
      >
    </button>
  </div>
</div>

<style lang="postcss">
  .locked-overlay {
    box-shadow: inset 0 0 0 calc(4px) var(--color-gray-8);
    z-index: 999999;
    position: absolute;
    inset: 0px;
    background: rgba(0, 0, 0, 0.7);
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
    flex-direction: column;
    .lock {
      color: white;
      display: flex;
      gap: 1rem;
      padding: 0.5rem 1rem;

      div {
        display: flex;
        align-items: center;
      }
    }
  }

  button {
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

    svg {
      height: 1.25rem;
      width: 1.25rem;
    }

    &:hover {
      z-index: 1; /* show full shadow */
      box-shadow: var(--primo-ring-primogreen);
    }

    &:active {
      background: var(--primo-color-brand);
      color: var(--color-gray-8);
    }

    /* &.top-right:first-child {
      border-bottom-left-radius: 0.25rem;
    } */

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
    justify-content: flex-end;
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
  span {
    margin-left: 0.5rem /* 8px */;
  }
</style>
