<script>

  import modal from '../../stores/app/modal'
  import {switchEnabled,userRole} from '../../stores/app/misc'

  export let variants = ''
  export let icon = ''
  export let title = ''
  export let button
  export let warn = () => true
  export let onclose = () => {}

  function closeModal() {
    if (warn()) {
      onclose()
      modal.hide()
    }
  }
</script>

<header class="modal-card-head {variants}" xyz="fade">
  <div class="flex-1 flex justify-start h-full">
    <button id="modal-close" on:click={closeModal} type="button" xyz="small" class="xyz-in inline-flex items-center justify-center rounded-md text-gray-400 pr-2 hover:text-primored focus:outline-none focus:text-primored transition duration-150 ease-in-out" aria-label="Close modal">
      <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  </div>
  <div class="flex items-center justify-center py-2 px-4">
    <p class="text-sm mr-4">
      {#if icon}
        <span class="icon mr-1">
          <i class={icon}></i>
        </span>
      {/if}
      <span class="modal-title">{title}</span>
    </p>
  </div>
  <div class="flex-1 flex justify-end">
    <slot></slot>
    {#if $userRole === 'developer' && $modal.showSwitch}
      <button on:click={() => $switchEnabled = !$switchEnabled} class="xyz-in button in-header font-semibold switch" class:to-cms={$switchEnabled} class:to-ide={!$switchEnabled}>
        {#if $switchEnabled}
          <i class="hidden lg:inline-block fas fa-edit lg:mr-1"></i>
          <span class="hidden lg:inline-block">Switch to CMS</span>
        {:else}
          <i class="hidden lg:inline-block fas fa-code lg:mr-1"></i>
          <span class="hidden lg:inline-block">Switch to IDE</span>
        {/if}
      </button>
    {/if}
    {#if button && button.onclick}
      <button class="xyz-in button primary" disabled={button.loading || button.disabled} on:click={button.onclick}>
        {#if button.icon}
          <i class="{button.loading ? 'fas fa-spinner' : button.icon}"></i>
        {/if}
        <span class="hidden lg:inline-block ml-1">
          {button.label}
        </span>
      </button>
    {:else if button && button.href}
       <!-- else if content here -->
      <a class="xyz-in button primary" disabled={button.loading || button.disabled} href={button.href} target="blank">
        {#if button.icon}
          <i class="{button.loading ? 'fas fa-spinner' : button.icon}"></i>
        {/if}
        <span class="hidden lg:inline-block ml-1">
          {button.label}
        </span>
      </a>
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
    @apply flex items-center py-1 px-3 text-sm rounded transition-colors duration-100;
  }
  .button.primary {
    @apply bg-primored text-white ml-2 font-medium;
  }
  .button.primary:hover {
      @apply bg-red-700;
    }
  .button.switch {
    @apply border-2 border-primored text-primored;
    outline-color: rgb(248,68,73);
  }
  .button.switch:hover {
      @apply bg-red-700 text-white border-red-700;
    }
  button[disabled] {
    @apply opacity-75 cursor-not-allowed transition-opacity duration-100;
  }
  .button.in-header {
    @apply text-gray-100;
  }
  .modal-card-head {
    @apply flex items-center justify-start relative bg-black text-gray-100 text-lg font-semibold py-1 px-3;
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