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
  {#if loading}
    <Spinner />
  {:else if label && icon}
    <span class="label">{label}</span>
  {:else if icon}
    <div class="icon" class:hidden={$showKeyHint && key}>{@html svg(icon)}</div>
  {/if}
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

    --Spinner-size: 0.75rem;

    &:first-child {
      border-top-left-radius: var(--primo-border-radius);
      border-bottom-left-radius: var(--primo-border-radius);
    }

    &:last-child {
      border-top-right-radius: var(--primo-border-radius);
      border-bottom-right-radius: var(--primo-border-radius);
    }

    &[disabled] {
      background: none;
      opacity: 0.35;
      pointer-events: none;
    }

    .icon {
      pointer-events: none;
      fill: var(--primo-color-white);
      width: 0.75rem;
    }
  }

  .hidden {
    opacity: 0;
  }
  .primo {
    color: var(--primo-color-white);
    border: 2px solid var(--primo-color-primogreen);
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
  .button-container {
    display: flex;
    justify-content: center;
    position: relative;
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
    transition: 0.1s box-shadow;
    outline: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;

    &:hover,
    &:focus {
      box-shadow: var(--primo-ring-primored);
      z-index: 2;
    }

    &:active {
      background: var(--primo-color-primogreen);
      color: var(--color-gray-8);
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

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

</style>
