<script>
  import { fade } from 'svelte/transition';
  import modal from '../../stores/app/modal';
  import { switchEnabled } from '../../stores/app';
  import Mousetrap from 'mousetrap';

  export let visible;

  Mousetrap.bind(['esc'], () => {
    if (!$modal.disabledBgClose) {
      modal.hide();
    }
  });

  $: header = $modal.header;
  $: button = $modal.button;
  $: variants = $modal.variants || 'max-w-md';

  function switchView() {
    $switchEnabled = !$switchEnabled;
  }

</script>

{#if visible}
  <div class="modal m-0 mousetrap" transition:fade={{ duration: 100 }}>
    <div
      class="modal-background"
      class:hovered={!$modal.disabledBgClose}
      on:click={$modal.disabledBgClose ? () => {} : () => modal.hide()} />
    <div class="modal-card {variants}">
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
  .switch {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--color-primored);
    color: var(--color-primored);
    font-size: var(--font-size-2);
    border-radius: var(--border-radius-1);
    transition: var(--transition-colors);
    outline-color: var(--color-primored);

    &:hover {
      background: var(--color-primored-dark);
      color: var(--color-white);
    }
  }

  .modal {
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: fixed;
    z-index: 40;
    inset: 0;
  }

  .modal-background {
    position: absolute;
    inset: 0;
    background: var(--color-codeblack-opaque);

    &.hovered {
      opacity: 0.9;
      transition: opacity 0.1s;
      cursor: pointer;
    }
  }

  .modal-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    overflow: hidden;
    margin: 0 auto;
    position: relative;
    border-radius: var(--border-radius-1);
    max-height: calc(100vh - 2rem);
  }

  .modal-card-body {
    background: var(--color-black);
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: 6px;
    overflow-y: scroll;
  }

  .modal {
    z-index: 999;
  }

  .fullscreen {
    width: calc(100vw - 1rem) !important;
    height: calc(100vh - 1rem) !important;
    position: absolute !important;
    left: 0.5rem !important;
    right: 0.5rem !important;
    top: 0.5rem !important;
    bottom: 0.5rem !important;
    max-height: initial !important;
  }

  .fullscreen .modal-card-body {
    overflow: scroll;
  }

</style>
