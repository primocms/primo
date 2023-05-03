<script>
  import { getContext } from 'svelte'
  import Icon from '@iconify/svelte'
  import { page } from '$app/stores'
  import modal from '../../stores/app/modal'
  import { showingIDE, userRole } from '../../stores/app/misc'
  import LocaleSelector from '../../views/editor/LocaleSelector.svelte'

  export let variants = ''
  export let icon = ''
  export let svg = ''
  export let title = ''
  export let button = null
  export let warn = () => true
  export let onclose = () => {}
  export let showLocaleSelector = true

  function closeModal() {
    if (warn()) {
      onclose()
      modal.hide()
    }
  }
</script>

<header class={variants}>
  <div class="left-container">
    <button on:click={closeModal} type="button" aria-label="Close modal">
      <svg stroke="currentColor" fill="none" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  </div>
  <div class="center-container">
    {#if icon}
      <span class="icon">
        <Icon {icon} />
      </span>
    {:else if svg}
      <div class="svg">{@html svg}</div>
    {/if}
    <span class="modal-title">{title}</span>
  </div>
  <div class="right-container">
    <slot />
    {#if !$showingIDE && !$modal.hideLocaleSelector && showLocaleSelector}
      <LocaleSelector align="left" />
    {/if}
    {#if $page.data.user.role === 'DEV' && $modal.showSwitch}
      {#if $showingIDE}
        <button
          class="code-mode"
          on:click={() => ($showingIDE = !$showingIDE)}
          class:on={$showingIDE}
          aria-label="Toggle code mode"
        >
          <Icon icon="material-symbols:edit-square-outline-rounded" />
        </button>
      {:else}
        <button
          class="code-mode"
          on:click={() => ($showingIDE = !$showingIDE)}
          class:on={$showingIDE}
          aria-label="Toggle code mode"
        >
          <Icon icon="ic:round-code" />
        </button>
      {/if}
    {/if}
    {#if button && button.onclick}
      <button
        class="primo-button primary"
        disabled={button.loading || button.disabled}
        on:click={button.onclick}
      >
        {#if button.icon}
          <Icon icon={button.loading ? 'gg:spinner' : button.icon} />
        {/if}
        <span>{button.label}</span>
      </button>
    {:else if button && button.href}
      <a
        class="primo-button primary"
        disabled={button.loading || button.disabled}
        href={button.href}
        target="blank"
      >
        {#if button.icon}
          <Icon icon={button.loading ? 'gg:spinner' : button.icon} />
        {/if}
        <span>{button.label}</span>
      </a>
    {/if}
  </div>
</header>

<style lang="postcss">
  header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    position: relative;
    background: var(--primo-color-black);
    color: var(--color-gray-1);
    font-size: var(--font-size-3);
    font-weight: 600;
    padding: 0.5rem;

    .left-container {
      flex: 1;
      display: flex;
      justify-content: flex-start;
      height: 100%;

      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--primo-border-radius);
        color: var(--color-gray-4);
        padding-right: 0.5rem;
        transition: var(--transition-colors);

        &:hover {
          color: var(--primo-color-brand);
        }

        &:focus {
          color: var(--primo-color-brand);
          outline: 0;
        }

        svg {
          width: 1.5rem;
          height: 1.5rem;
        }
      }
    }

    .center-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      font-size: var(--font-size-2);
      font-weight: 600;
      gap: 0.25rem;

      .svg {
        :global(svg) {
          --size: 1rem;
          width: var(--size);
          height: var(--size);
        }
      }
    }

    .right-container {
      flex: 1;
      display: flex;
      justify-content: flex-end;

      .code-mode {
        padding: 0 1rem;
        border-radius: 0.25rem;
        color: var(--color-gray-1);
        background: var(--color-gray-9);
      }
    }
  }

  .primo-button {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    font-size: var(--font-size-2);
    border-radius: var(--primo-border-radius);
    transition: var(--transition-colors), 0.1s box-shadow;

    &.primary {
      border: 2px solid var(--primo-color-brand);
      color: var(--primo-color-white);
      margin-left: 0.5rem;

      span {
        display: none;
        margin-left: 0.25rem;

        @media (min-width: 900px) {
          display: inline-block;
        }
      }

      &:hover {
        box-shadow: var(--primo-ring-primogreen);
      }

      &:active {
        color: var(--primo-color-black);
        background: var(--primo-color-brand);
      }
    }

    &.switch {
      border: 2px solid var(--primo-color-brand);
      color: var(--primo-color-brand);
      outline-color: var(--primo-color-brand);

      &:hover {
        background: var(--primo-color-brand-dark);
        color: var(--primo-color-white);
        border-color: var(--primo-color-brand-dark);
      }
    }
  }

  button[disabled] {
    opacity: 0.25;
    transition: opacity 0.1s;
  }
</style>
