<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher, onMount } from 'svelte';
  const dispatch = createEventDispatcher();

  import SymbolContainer from '../../../modal/SymbolLibrary/SymbolContainer.svelte';

  export let symbol;
  export let title = symbol.title || '';
  export let buttons = [];
  export let titleEditable;
  export let loadPreview = true;

  let editingTitle = false;
  let titleInput;

  function changeTitle() {
    editingTitle = false;
    if (title !== symbol.title) {
      dispatch('update', { title });
    }
  }

</script>

<div
  class="component-wrapper"
  in:fade={{ delay: 250, duration: 200 }}
  id="symbol-{symbol.id}">
  {#if titleEditable}
    <form class="cursor-pointer" on:submit|preventDefault={changeTitle}>
      <input
        class="cursor-pointer"
        type="text"
        bind:this={titleInput}
        bind:value={title}
        on:blur={changeTitle}
        on:focus={() => (editingTitle = true)} />
    </form>
  {/if}
  <div class="component-header">
    <p class="component-label"><span>{title}</span></p>
    <div class="buttons">
      {#each buttons as button}
        <button class:bg-primored={button.highlight} on:click={button.onclick}>
          <span>{button.label}</span>
          {@html button.svg}
        </button>
      {/each}
    </div>
  </div>
  <SymbolContainer {symbol} />
</div>

<style lang="postcss">
  .component-header {
    margin-bottom: -2rem;
    z-index: 1;
    background: rgba(20, 20, 20, 0.75);
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }
  .buttons {
    display: flex;

    button {
      transition: background-color 0.1s;
      padding: 0.5rem;
      display: flex;
      align-items: center;

      span {
        font-size: 0.75rem;
        line-height: 1rem;
        font-weight: 600;
      }
    }
  }
  .component {
    display: flex;
    flex-direction: column;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), 0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    color: rgba(255, 255, 255, var(--tw-text-opacity));
    border-radius: 0.25rem /* 4px */;
  }
  .component-wrapper {
    height: 40vh;
    overflow: hidden;
    position: relative;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), 0 1px 3px 0 rgba(0, 0, 0, 0.1),
      0 1px 2px 0 rgba(0, 0, 0, 0.06);
    content-visibility: auto;
  }

  button:hover {
    background-color: rgba(220, 38, 38, var(--tw-bg-opacity));
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
  }

  .fadein {
    opacity: 1;
  }
  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: rgba(245, 245, 245, var(--tw-bg-opacity));
    padding: 0.25rem /* 4px */;
  }
  .component-label {
    display: flex;
    align-items: center;
    flex: 1 1 0%;
    padding-left: 0.5rem /* 8px */;
    min-width: 3rem;
    height: 1.5rem;
    font-size: 0.75rem /* 12px */;
    line-height: 1rem /* 16px */;
    font-weight: 500;
    margin-left: 0.25rem /* 4px */;
  }
  .component-label:before {
    content: '';
    display: inline-block;
    height: 1rem;
    width: 0;
    margin-right: 0;
    transition: margin-right 0.25s, width 0.25s;
    background: gainsboro;
  }
  input {
    user-select: none;
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }
  .editing:before {
    content: '';
    width: 4px;
    margin-right: 5px;
    transition: margin-right 0.25s, width 0.25s;
  }
  form {
    cursor: pointer;
  }
  .component-frame {
    display: flex;
    flex-direction: column;
    position: relative;
    background-color: rgba(245, 245, 245, var(--tw-bg-opacity));
    flex: 1 1 0%;
  }
  .component-spinner {
    background-color: rgba(23, 23, 23, var(--tw-bg-opacity));
    width: 100%;
    height: 100%;
    left: 0px;
    top: 0px;
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 50;
  }

</style>
