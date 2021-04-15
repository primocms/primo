<script>
  import { createEventDispatcher } from 'svelte';
  import { fade } from "svelte/transition";
  import {showKeyHint} from '../../stores/app/misc'

  const dispatch = createEventDispatcher();

  export let id = null
  export let title = ''
  export let buttonStyles = ''
  export let key = null
  export let icon = null
  export let disabled = false
  export let onclick = null
  export let variant = ''
  export let loading = false
  export let active = false
  export let buttons = null
  export let type = null
  export let tooltipStyle = ''
  export let tooltipVariants = ''

  let subButtonsActive = false

  $: if (icon && !icon.includes('fa-')) {
    icon = `fas fa-${icon}`
  }
  
</script>

<div class="button-group button-container">
  <button
    {id}
    aria-label={title}
    class="{ buttonStyles } {variant}"
    class:primo={type === 'primo'}
    class:active
    class:has-subbuttons={buttons}
    in:fade={{duration:200}}
    {disabled}
    on:click={() => {
      subButtonsActive = !subButtonsActive
      onclick ? onclick() : dispatch('click')
    }}>
    {#if icon}
      {#if key}
        <span class="key-hint" class:active={$showKeyHint} aria-hidden>&#8984;{key.toUpperCase()}</span>
      {/if}
      <i class="{ !loading ? icon : 'fas fa-spinner'} w-4" />
    {:else} 
      <slot></slot>
    {/if}
  </button>
  {#if buttons}
    <!-- <div class="tooltip sub-buttons" class:active={subButtonsActive}> -->
    <div class="tooltip sub-buttons" style={tooltipStyle}>
      {#each buttons as button}
        <button 
          id="primo-toolbar--{button.id}"
          on:click={() => { 
            subButtonsActive = true; 
            if (button.onclick) button.onclick()
          }} 
          class="sub-button"
        >
          {#if button.key}
            <span class="key-hint" class:active={$showKeyHint} aria-hidden>&#8984;{button.key.toUpperCase()}</span>
          {/if}
          <i class="fas fa-{button.icon}" aria-label={button.title}/>
        </button>
      {/each}
    </div>
  {:else if title}
    <div class="tooltip lg:block {tooltipVariants}">{title}</div>
  {/if}
</div>

<style>
  .button-group:after {
    content: '';
    @apply w-8 h-4 absolute;
    bottom: -1rem;
  }

  .primo {
    @apply bg-primored text-gray-100;
  }

  .key-hint {
    @apply absolute w-full text-center left-0 opacity-0;
  }

  .key-hint.active {
    @apply opacity-100 transition-opacity duration-100;
  }

  .key-hint.active + i {
      @apply opacity-0 transition-opacity duration-100;
    } 

  .button-container {
    @apply flex justify-center relative;
  }

  .tooltip.sub-buttons {
    @apply pointer-events-auto cursor-default p-0 bg-codeblack shadow flex;
    z-index: 999;
    left: 12rem;
  }

  .tooltip.sub-buttons:before, .tooltip.sub-buttons:after {
      left: 5%;
      @apply border-codeblack;
      border-top-color: transparent;
      border-left-color: transparent;
      border-right-color: transparent;
    }
    .tooltip.sub-buttons button:hover, .tooltip.sub-buttons button:focus {
      @apply bg-gray-700;
    }

  .has-subbuttons {

  }

  .has-subbuttons:hover .has-subbuttons:after, .has-subbuttons:focus .has-subbuttons:after {
    content: '';
        @apply h-4 absolute left-0 cursor-default;
        bottom: -1rem;
        right: -1rem;
    }

  .tooltip {
    @apply absolute text-center text-gray-100 font-bold bg-gray-800 px-4 py-2 text-sm pointer-events-none invisible opacity-0 transition-opacity duration-200;
    left: 50%;
    transform: translateX(-50%);
    top: calc(100% + 0.75rem);
  }

  .button-container:hover .tooltip, .button-container:focus .tooltip, .sub-buttons:hover, .tooltip.active {
    @apply visible opacity-100 transition-opacity duration-200;
  }

  .tooltip:before, .tooltip:after {
    content: " ";
    @apply h-0 w-0 border-solid border-gray-800;
    border-top-color: transparent;
    border-left-color: transparent;
    border-right-color: transparent;
    bottom: 100%;
    left: 50%;
    position: absolute;
    pointer-events: none;
    border-width: 7px;
    margin-left: -7px;
  }

  :global(.heading2) {
    font-size: 14px !important;
    position: relative;
    top: 1px;
  }

  button {
    @apply bg-codeblack text-white font-bold py-2 px-3 transition-colors outline-none relative;
  }

  button:hover, button:focus {
      @apply bg-gray-800 transition-colors duration-200;
    }

    button.key-hint {
        @apply opacity-100 transition-opacity duration-100;
      }
      button.key-hint + i {
        @apply opacity-0 transition-opacity duration-100;
      }


  button[disabled] {
    @apply text-gray-700 bg-codeblack cursor-default transition-colors duration-200;
  }

  button.outlined {
    @apply border border-solid border-gray-800;
  }

  button.inverted {
    @apply border-0 bg-gray-300 text-codeblack;
  }

  button.inverted:hover, button.inverted:focus {
    @apply bg-gray-800 text-white transition-colors duration-200;
  }

  button.primored {
    @apply border-0 bg-primored text-gray-100;
  }

  button.primored:hover, button.primored:focus {
    @apply bg-gray-800;
  }

  button i.fa-hammer {
    transition: transform 0.2s;
    transform: rotate(0);
    transform-origin: left;
  }

  button:hover i.fa-hammer {
    transition: transform 0.2s;
    transform: rotate(-20deg);
  }

  button.active i.fa-hammer {
    animation-name: hammer;
    animation-duration: 1s;
    animation-iteration-count: infinite;
    animation-timing-function: ease;
    will-change: transform;
  }

  @keyframes hammer {
    0% {
      transform: rotate(0deg);
    }
    20% {
      transform: rotate(-20deg);
    }
    50% {
      transform: rotate(45deg);
    }
    100% {
      transform: rotate(0deg);
    }
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

