<script lang="ts">
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  import modal from '../../stores/app/modal'
  import {editorViewDev,userRole} from '../../stores/app/misc'

  export let variants:string = ''
  export let icon:string = ''
  export let title:string = ''
  export let button:{ label:string, icon:string, onclick: any, loading?: boolean } = null
  export let onclose = () => {}

  function closeModal() {
    onclose()
    modal.hide()
  }
</script>

<header class="modal-card-head {variants}">
  <div class="flex-1 flex justify-start">
    <button id="modal-close" on:click={closeModal} type="button" class="inline-flex items-center justify-center rounded-md text-gray-400 p-2 hover:text-gray-500 hover:bg-gray-200 focus:outline-none focus:bg-gray-200 focus:text-gray-500 transition duration-150 ease-in-out" aria-label="Close modal">
      <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  </div>
  <div class="flex items-center justify-center py-2 px-4">
    <p class="text-sm text-gray-700 mr-4">
      {#if icon}
        <span class="icon">
          <i class={icon}></i>
        </span>
      {/if}
      <span class="modal-title">{title}</span>
    </p>
  </div>
  <div class="flex-1 flex justify-end">
    {#if $userRole === 'developer' && $modal.showSwitch}
      <button on:click={() => $editorViewDev = !$editorViewDev} class="button switch" class:to-cms={$editorViewDev} class:to-ide={!$editorViewDev}>
        {#if $editorViewDev}
          <i class="fas fa-edit"></i>
          <span class="hidden lg:inline-block">Switch to CMS</span>
        {:else}
          <i class="fas fa-code"></i>
          <span class="hidden lg:inline-block">Switch to IDE</span>
        {/if}
      </button>
    {/if}
    {#if button}
      <button class="button primary" disabled={button.loading} on:click={button.onclick}>
        {#if button.icon}
          <i class="{button.loading ? 'fas fa-spinner' : button.icon} mr-1"></i>
        {/if}
        <span class="hidden lg:inline-block">
          {button.label}
        </span>
      </button>
    {/if}
  </div>
</header>

<style>
  header {
    margin-top: -0.75rem;
    margin-left: -0.75rem;
    margin-right: -0.75rem;
  }
  .button {
    @apply py-1 px-3 text-sm rounded transition-colors duration-200;
  }
  .button.primary {
    @apply bg-primored text-white ml-2;
    &:hover {
      @apply bg-red-700;
    }
  }
  .button.switch {
    @apply border border-primored text-primored;
    outline-color: rgb(248,68,73);
    &:hover {
      @apply bg-red-700 text-white;
    }
  }
  button[disabled] {
    @apply opacity-75 cursor-not-allowed transition-opacity duration-100 !important;
  }
  .modal-card-head {
    @apply flex items-center justify-start relative bg-gray-100 text-gray-800 text-lg font-semibold py-1 px-3;
  }

  i.fa-spinner {
    animation-name: spin;
    animation-duration: 1s;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
    will-change: transform;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>