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
  <div class="modal mousetrap" transition:fade={{ duration: 100 }}>
    <div class="modal-background" on:click={$modal.disableClose ? () => {} : closeModal}></div>
    <div class="modal-card {variants}">
      {#if header}
        <header class="modal-card-head">
          <div class="flex items-center flex-1 justify-between pr-2">
            <p class="text-sm text-gray-700 mr-4">
              {#if header.icon}
                <span class="icon">
                  <i class={header.icon}></i>
                </span>
              {/if}
              <span class="modal-title">{header.title}</span>
            </p>
            {#if $modal.showSwitch && $userRole === 'developer'}
              <button on:click={switchView} class="switch" class:to-cms={$editorViewDev} class:to-ide={!$editorViewDev}>
                {#if $editorViewDev}
                  <i class="fas fa-edit"></i>
                  <span>Switch to CMS</span>
                {:else}
                  <i class="fas fa-code"></i>
                  <span>Switch to IDE</span>
                {/if}
              </button>
            {/if}
            </div>
          <button id="modal-close" on:click={closeModal} type="button" class="inline-flex items-center justify-center rounded-md text-gray-400 p-2 hover:text-gray-500 hover:bg-gray-200 focus:outline-none focus:bg-gray-200 focus:text-gray-500 transition duration-150 ease-in-out" aria-label="Close modal">
            <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </header>
      {/if}
      <div class="modal-card-body">
        <svelte:component this={$modal.component} { ...$modal.componentProps } />
      </div>
      {#if button}
        <footer class="modal-card-foot">
          <button 
            id="modal-footer-button"
            class="button is-link" 
            disabled={false}
            on:click={button.onclick}>
              {#if button.loading}
                <Spinner size="lg" />
              {:else}
                {button.label}
              {/if}
          </button>
        </footer>
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

  .modal-card-foot, .modal-card-head {
    @apply flex items-center justify-start p-4 relative bg-gray-100;
  }

  .modal-card-head {
    @apply text-gray-800 text-lg font-semibold py-2 px-4;
  }

  .modal-card-title {
    @apply text-lg;
  }

  .modal-card-title > .modal-title {
    @apply pl-1;
  }

  .modal-card-body {
    @apply bg-white flex-1 p-5;
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
    padding-bottom: 0;
    padding-top: 0;
    @apply overflow-scroll;
  }

</style>