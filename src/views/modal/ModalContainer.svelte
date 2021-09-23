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

  $: variants = $modal.variants || 'max-w-md';

  function switchView() {
    $switchEnabled = !$switchEnabled;
  }

</script>

{#if visible}
  <div class="modal mousetrap primo-reset" transition:fade={{ duration: 100 }}>
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
  }

  .modal-background {
    position: absolute;
    inset: 0;
    background: var(--primo-color-codeblack-opaque);

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
    position: relative;
    border-radius: var(--border-radius-1);
    max-height: 100vh;
    padding: 1rem;

    &.fullscreen {
      height: 100%;
    }
  }

  .modal-card-body {
    border-radius: 1px;
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: var(--border-radius-1);
    height: calc(
      100vh - 6rem
    ); /* to allow children to scroll on overflow (i.e. not grow) */
    /* overflow-y: scroll; */ /* causes Styles to scroll by an inch */
  }

</style>
