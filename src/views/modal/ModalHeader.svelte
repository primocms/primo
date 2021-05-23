<script>

  import modal from '../../stores/app/modal'
  import {switchEnabled,userRole,onMobile} from '../../stores/app/misc'

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
      <div class="content xyz-in" id="ide-toggle">
        <label class="switch">
          <input type="checkbox" bind:checked={$switchEnabled}>
          <span class="slider round" class:code={$switchEnabled}>
            <i class="fas fa-code"></i> 
            <i class="fas fa-edit"></i>    
          </span>
          <span class="sr-only">Switch to {$switchEnabled ? 'CMS' : 'IDE'}</span>
        </label>
      </div>
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
  .content {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 0.5rem;
    padding-left: 0.5rem;
  }

  .switch {
    position: relative;
    display: flex;
    align-items: center;
    width: 50px;
    height: 26px;
  }

  .switch i {
    font-size: 11px;
    height: 100%;
    display: flex;
    align-items: center;
    width: 50%;
    justify-content: center;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgb(248,68,73);
    transition: .4s;
    display: flex;
    align-items: center;
  }

  .slider i.fa-edit {
    color: rgb(248,68,73);
  }

  .slider.code i.fa-edit {
    color: white;
  }

  .slider.code i.fa-code {
    color: rgb(248,68,73);
  }



  .slider i {
    position: absolute;
    z-index: 1;
    color: white;
  }

  .slider i.fa-edit {
    left: 1px;
    bottom: 1px;
  }

  .slider i.fa-code {
    /* right: 1px; */
    right: 0;
    bottom: 1px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    z-index: 1;
    background-color: white;
    transition: background-color .4s, transform 0.1s;
    box-shadow: 0px 0px 3px 0px rgb(0 0 0 / 50%);
  }

  input:checked + .slider {

  }

  input:focus + .slider {
    outline: none;
  }

  input:checked + .slider:before {
    transform: translateX(24px);
    transition: .1s;
  }

  .slider.round {
    border-radius: 34px;
  }

  .slider.round:before {
    border-radius: 50%;
  }
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