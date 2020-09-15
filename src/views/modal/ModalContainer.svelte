<script>
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import modal from '../../stores/app/modal'
  import {editorViewDev,userRole} from '../../stores/app'
  import {Spinner} from '../../components/misc'
  const dispatch = createEventDispatcher()


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
    $editorViewDev = !$editorViewDev
  }

</script>

{#if $modal.visible}
  <div class="modal m-2 lg:m-0 mousetrap" transition:fade={{ duration: 100 }}>
    <div class="modal-background" on:click={$modal.disableClose ? () => {} : closeModal}></div>
    <div class="modal-card {variants}">
      <div class="modal-card-body">
        <svelte:component this={$modal.component} { ...$modal.componentProps } />
      </div>
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
    @apply bg-white flex-1 p-3 flex flex-col;
  }

  .modal-card-foot {
    justify-content: flex-end !important;
  }

  .modal {
    z-index: 999;
  }

  .fullscreen {
    width: calc(100vw - 3rem) !important;
    height: calc(100vh - 3rem) !important;
    position: absolute !important;
    left: 1.5rem !important;
    right: 1.5rem !important;
    top: 1.5rem !important;
    bottom: 1.5rem !important;
    max-height: initial !important;
  }

  .fullscreen .modal-card-body {
    @apply overflow-scroll;
  }

</style>