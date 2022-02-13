<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import modal from '../../stores/app/modal';
  import { showingIDE } from '../../stores/app';
  import * as Mousetrap from 'mousetrap';

  export let visible;

  onMount(() => {
    Mousetrap.bind(['esc'], () => {
      if (!$modal.disabledBgClose) {
        modal.hide();
      }
    });
  });

  $: variants = $modal.variants || '';

  function switchView() {
    $showingIDE = !$showingIDE;
  }

</script>

{#if visible}
  <div id="primo-modal" class="modal mousetrap primo-reset {variants}" transition:fade={{ duration: 100 }}>
    <div
      class="modal-background"
      class:hovered={!$modal.disabledBgClose}
      on:click={$modal.disabledBgClose ? () => {} : () => modal.hide()} />
    <div class="modal-card">
      <div class="modal-card-body" class:p-3={!$modal.noPadding}>
        <slot />
      </div>
      {#if $modal.footer}
        <svelte:component this={$modal.footer} />
      {/if}
    </div>
  </div>
{/if}

<style lang="postcss">
  .modal {
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow: hidden;
    position: fixed;
    z-index: 999999999;
    inset: 0;
    top: 0;

    &.small .modal-card {
      max-width: 30rem;
      margin: 0 auto;
    }
  }

  .modal-background {
    position: absolute;
    inset: 0;
    background: var(--primo-color-black);

    &.hovered {
      opacity: 0.95;
      transition: opacity 0.1s;
      cursor: pointer;
    }
  }

  .modal-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    overflow: hidden;
    position: relative;
    border-radius: var(--primo-border-radius);
    max-height: 100vh;
    padding: 0 1rem; /* pushes content out of sight on windows if vertical */
    height: 100%; /* make component editor full height when in cms) */

    &.fullscreen {
      height: 100%;
    }
  }

  .modal-card-body {
    border-radius: 1px;
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: var(--primo-border-radius);
    justify-content: center;
    height: calc(
      100vh - 6rem
    ); /* to allow children to scroll on overflow (i.e. not grow) */
    /* overflow-y: scroll; */ /* causes Styles to scroll by an inch */
  }

</style>
