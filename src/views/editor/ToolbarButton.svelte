<script>
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { showKeyHint, onMobile } from '../../stores/app/misc';

  const dispatch = createEventDispatcher();

  export let id = null;
  export let title = '';
  export let label = null;
  export let buttonStyles = '';
  export let key = null;
  export let icon = null;
  export let disabled = false;
  export let onclick = null;
  export let variant = '';
  export let loading = false;
  export let active = false;
  export let buttons = null;
  export let type = null;
  export let tooltipVariants = '';
  export let hideTooltip = false;
  export let style = '';

  let subButtonsActive = false;

  $: if (icon && !icon.includes('fa-')) {
    icon = `fas fa-${icon}`;
  }

</script>

<div class="button-group button-container">
  <button
    {id}
    aria-label={title}
    class="{buttonStyles} {variant}"
    class:primo={type === 'primo'}
    class:active
    class:has-subbuttons={buttons}
    {style}
    in:fade={{ duration: 200 }}
    {disabled}
    on:click={() => {
      subButtonsActive = !subButtonsActive;
      onclick ? onclick() : dispatch('click');
    }}>
    {#if icon}
      {#if key}
        <span
          class="key-hint"
          class:active={$showKeyHint}
          aria-hidden>&#8984;{key.toUpperCase()}</span>
      {/if}
      {#if label}<span>{label}</span>{/if}
      {#if loading}<i class="fas fa-spinner" />{/if}
      <i class={icon} class:hidden={loading} />
    {:else}
      <slot />
    {/if}
  </button>
  {#if title && !$onMobile && !hideTooltip}
    <div class="tooltip lg:block {tooltipVariants}">{title}</div>
  {/if}
</div>

<style lang="postcss">
  .fas.fa-spinner {
    position: absolute;
  }
  .hidden {
    opacity: 0;
  }
  .primo {
    background: var(--color-primored);
    color: var(--color-gray-1);

    &:hover {
      background: var(--color-primored-dark);
    }
  }

  .key-hint {
    position: absolute;
    width: 100%;
    text-align: center;
    left: 0;
    opacity: 0;
  }

  .key-hint.active {
    opacity: 1;
    transition: opacity 0.1s;
  }

  .key-hint.active + i {
    opacity: 0;
    transition: opacity 0.1s;
  }

  .button-container {
    display: flex;
    justify-content: center;
    position: relative;
  }

  .tooltip.sub-buttons {
    pointer-events: none;
    cursor: default;
    padding: 0;
    background: var(--color-codeblack);
    box-shadow: var(--box-shadow);
    display: flex;
    z-index: 999;
    left: 12rem;
  }

  .tooltip.sub-buttons:before,
  .tooltip.sub-buttons:after {
    left: 5%;
    background: var(--color-codeblack);
    border-top-color: transparent;
    border-left-color: transparent;
    border-right-color: transparent;
  }

  .has-subbuttons:hover .has-subbuttons:after,
  .has-subbuttons:focus .has-subbuttons:after {
    content: '';
    height: 1rem;
    position: absolute;
    left: 0;
    cursor: default;
    bottom: -1rem;
    right: -1rem;
  }

  .tooltip {
    position: absolute;
    text-align: center;
    color: var(--color-gray-1);
    font-weight: 700;
    background: var(--color-gray-8);
    padding: 8px 16px;
    font-size: var(--font-size-2);
    pointer-events: none;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.2s;
    left: 50%;
    transform: translateX(-50%);
    top: calc(100% + 0.75rem);
  }

  .button-container:hover .tooltip,
  .button-container:focus .tooltip,
  .sub-buttons:hover,
  .tooltip.active {
    visibility: visible;
    opacity: 1;
    transition: opacity 0.2s;
  }

  .tooltip:before,
  .tooltip:after {
    content: ' ';
    height: 0;
    width: 0;
    border: 1px solid var(--color-gray-8);
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
    background: var(--color-codeblack);
    color: var(--color-white);
    font-weight: 700;
    padding: 10px 15px;
    transition: var(--transition-colors);
    outline: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    &[aria-label='Publish'] {
      span {
        font-size: 0.85rem;
        margin-right: 0.5rem;
      }
      i {
        transition: transform 0.2s;
        transform: scale(1);
        transform-origin: center;
      }

      &:hover i {
        transition: transform 0.2s;
        transform: scale(1.2);
      }
    }

    &:hover,
    &:focus {
      background: var(--color-gray-8);
      transition: var(--transition-colors);
    }
  }

  button.key-hint {
    opacity: 1;
    transition: opacity 0.1s;
  }

  button[disabled] {
    color: var(--color-gray-7);
    background: var(--color-codeblack);
    cursor: default;
    transition: var(--transition-colors);
  }

  button.outlined {
    border: 1px solid var(--color-gray-8);
  }

  button.inverted {
    border: 0;
    background: var(--color-gray-3);
    color: var(--color-codeblack);
  }

  button.inverted:hover,
  button.inverted:focus {
    background: var(--color-gray-8);
    color: var(--color-white);
    transition: var(--transition-colors);
  }

  button.primored {
    border: 0;
    background: var(--color-primored);
    color: var(--color-gray-1);
  }

  button.primored:hover,
  button.primored:focus {
    background: var(--color-gray-8);
  }

  /* button i.fa-paper-plane {
    transition: transform 0.2s;
    transform: translate(0);
    transform-origin: left;
  }

  button:hover i.fa-paper-plane {
    transition: transform 0.2s;
    transform: translate(-4px, 4px);
  }

  button.active i.fa-paper-plane {
    animation-name: hammer;
    animation-duration: 1s;
    animation-iteration-count: infinite;
    animation-timing-function: ease;
    will-change: transform;
  } */

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
