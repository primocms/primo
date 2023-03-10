<script>
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import Icon from '@iconify/svelte'
  import Spinner from '../../components/misc/Spinner.svelte'
  import { showKeyHint, onMobile } from '../../stores/app/misc'

  const dispatch = createEventDispatcher()

  export let id = null
  export let title = ''
  export let label = null
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
  export let style = ''

  let subButtonsActive = false
</script>

<button
  {id}
  aria-label={title}
  class="button"
  class:primo={type === 'primo'}
  class:active
  class:has-subbuttons={buttons}
  {style}
  in:fade={{ duration: 200 }}
  {disabled}
  on:click={() => {
    subButtonsActive = !subButtonsActive
    onclick ? onclick() : dispatch('click')
  }}
>
  {#if icon}
    {#if key}
      <span class="key-hint" class:active={$showKeyHint} aria-hidden
        >&#8984;{key.toUpperCase()}</span
      >
    {/if}
    {#if loading}
      <Spinner />
    {:else if label && icon}
      <span class="label">{label}</span>
    {:else if icon}
      <Icon {icon} />
    {/if}
  {:else}
    <slot>
      <span>{label}</span>
    </slot>
  {/if}
</button>

<style lang="postcss">
  .button {
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
  }

  .primo {
    color: var(--primo-color-white);
    border: 2px solid var(--primo-color-brand);
  }

  .button {
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
      box-shadow: var(--primo-ring-primogreen);
      z-index: 2;
    }

    &:active {
      background: var(--primo-color-brand);
      color: var(--color-gray-8);
    }
  }

  .button.key-hint {
    opacity: 1;
    transition: opacity 0.1s;
  }

  .button[disabled] {
    opacity: 0.1;
    cursor: default;
    transition: var(--transition-colors);

    &:hover,
    &:focus {
      box-shadow: none;
    }
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
