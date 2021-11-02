<script>
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import Spinner from '../../components/misc/Spinner.svelte'
  import { showKeyHint, onMobile } from '../../stores/app/misc';
  import svg from '../../svg'

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

</script>

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
  <div class="icon" class:hidden={loading || $showKeyHint && key}>{@html svg(icon)}</div>
  {#if label}<span class="label">{label}</span>{/if}
  {#if loading}<Spinner />{/if}
{:else}
  <slot>
    <span>{label}</span>
  </slot>
{/if}
</button>

<style lang="postcss">
  button {
    font-size: 0.85rem;
    user-select: none;

    &:first-child {
      border-top-left-radius: var(--primo-border-radius);
      border-bottom-left-radius: var(--primo-border-radius);
    }

    &:last-child {
      border-top-right-radius: var(--primo-border-radius);
      border-bottom-right-radius: var(--primo-border-radius);
    }

    .icon {
      pointer-events: none;
      fill: var(--primo-color-white);
      width: 0.75rem;
    }

    .icon + span {
      margin-left: 0.5rem;
    }
  }

  .hidden {
    opacity: 0;
  }
  .primo {
    background: var(--primo-color-primored);
    color: var(--color-gray-1);

    &:hover {
      background: var(--primo-color-primored-dark);
    }
  }

  .key-hint {
    pointer-events: none;
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
    background: var(--primo-color-codeblack);
    color: var(--primo-color-white);
    font-weight: 700;
    padding: 0.5rem 1rem;
    transition: var(--transition-colors);
    outline: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;


    &:hover,
    &:focus {
      box-shadow: var(--primo-ring-primored);
      z-index: 2;
    }

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

      &:focus {
        background: var(--primo-color-primored-dark);
      }

      @media (max-width: 600px) {
        span {
          display: none;
        }
      }
    }
  }

  button.key-hint {
    opacity: 1;
    transition: opacity 0.1s;
  }

  button[disabled] {
    opacity: 0.1;
    cursor: default;
    transition: var(--transition-colors);

    &:hover, &:focus {
      box-shadow: none;
    }
  }

  button.outlined {
    border: 1px solid var(--color-gray-8);
  }

  button.inverted {
    border: 0;
    background: var(--color-gray-3);
    color: var(--primo-color-codeblack);
  }

  button.inverted:hover,
  button.inverted:focus {
    background: var(--color-gray-8);
    color: var(--primo-color-white);
    transition: var(--transition-colors);
  }

  button.primored {
    border: 0;
    background: var(--primo-color-primored);
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
