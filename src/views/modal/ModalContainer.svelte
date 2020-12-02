<script>
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import modal from '../../stores/app/modal'
  import {switchEnabled,userRole} from '../../stores/app'
  import {Spinner} from '../../components/misc'
  const dispatch = createEventDispatcher()
	import {push, location} from 'svelte-spa-router'
  import ModalHeader from './ModalHeader.svelte'

  export let visible

  Mousetrap.bind(['esc'], () => {
    modal.hide()
  })

  async function closeModal() {
    modal.hide()
  }

  $: header = $modal.header
  $: button = $modal.button
  $: variants = $modal.variants || 'max-w-md'

  function switchView() {
    $switchEnabled = !$switchEnabled
  }

</script>

{#if visible}
  <div class="modal m-0 mousetrap" transition:fade={{ duration: 100 }}>
    <div class="modal-background" on:click={$modal.disableClose ? () => {} : closeModal}></div>
    <div class="modal-card {variants}">
      <div class="modal-card-body" class:p-3={!$modal.noPadding}>
        <slot></slot>
      </div>
      {#if $modal.footer}
        <svelte:component this={$modal.footer} />
      {/if}
    </div>
  </div>
{/if}

<style>

  .switch {
    @apply py-1 px-3 border border-primored text-primored text-sm rounded transition-colors duration-200;
    outline-color: rgb(248,68,73);
    &:hover {
      @apply bg-red-700 text-white;
    }
  }

  .modal {
    @apply flex flex-col items-center justify-center overflow-hidden fixed z-40 bottom-0 left-0 right-0 top-0;
  }

  .modal-background {
    @apply bottom-0 left-0 right-0 top-0 absolute;
    background-color: rgba(10,10,10,.86);
  }

  .modal-card {
    @apply flex flex-col w-full overflow-scroll my-0 mx-auto relative rounded;
    position: relative;
    /* max-width: calc(100vw - 2rem); */
    max-height: calc(100vh - 2rem);
  }

  .modal-card-foot {
    @apply flex items-center justify-start p-4 relative bg-gray-100;
  }

  .modal-card-body {
    @apply bg-white flex-1 flex flex-col;
  }

  .modal-card-foot {
    justify-content: flex-end !important;
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
    @apply overflow-scroll;
  }

</style>