<script>
  import {getContext} from 'svelte'
  import modal from '../../stores/app/modal';
  import { showingIDE, userRole } from '../../stores/app/misc';
  import LocaleSelector from '../../views/editor/LocaleSelector.svelte'

  export let variants = '';
  export let icon = '';
  export let title = '';
  export let button = null;
  export let warn = () => true;
  export let onclose = () => {};
  export let showLocaleSelector = true

  function closeModal() {
    if (warn()) {
      onclose();
      modal.hide();
    }
  }
  
  const SHOW_SINGLE_LOCALE = getContext('SIMPLE')

</script>

<header class={variants} xyz="fade">
  <div class="left-container">
    <button
      on:click={closeModal}
      type="button"
      xyz="small"
      class="xyz-in"
      aria-label="Close modal">
      <svg stroke="currentColor" fill="none" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
  <div class="center-container">
    <p>
      {#if icon}<span class="icon"> <i class={icon} /> </span>{/if}
      <span class="modal-title">{title}</span>
    </p>
  </div>
  <div class="right-container">
    <slot />
     {#if !$showingIDE && !$modal.hideLocaleSelector && showLocaleSelector && !SHOW_SINGLE_LOCALE}
      <LocaleSelector align="left" />
    {/if}
    {#if $userRole === 'developer' && $modal.showSwitch}
      <div class="content xyz-in">
        <label class="switch">
          <input type="checkbox" bind:checked={$showingIDE} />
          <span class="slider round" class:code={$showingIDE}>
            <i class="fas fa-code" />
            <i class="fas fa-edit" />
          </span>
          <span class="sr-only">Switch to
            {$showingIDE ? 'Content' : 'Code'}</span>
        </label>
      </div>
    {/if}
    {#if button && button.onclick}
      <button
        class="xyz-in primo-button primary"
        disabled={button.loading || button.disabled}
        on:click={button.onclick}>
        {#if button.icon}
          <i class={button.loading ? 'fas fa-spinner' : button.icon} />
        {/if}
        <span> {button.label} </span>
      </button>
    {:else if button && button.href}
      <a
        class="xyz-in primo-button primary"
        disabled={button.loading || button.disabled}
        href={button.href}
        target="blank">
        {#if button.icon}
          <i class={button.loading ? 'fas fa-spinner' : button.icon} />
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
          color: var(--primo-color-primogreen);
        }

        &:focus {
          color: var(--primo-color-primogreen);
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

      span.icon {
        margin-right: 0.25rem;
      }

      p {
        font-size: var(--font-size-2);
      }
    }

    .right-container {
      flex: 1;
      display: flex;
      justify-content: flex-end;

      .content {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-right: 0.5rem;
        padding-left: 0.5rem;

        .switch {
          position: relative;
          display: flex;
          align-items: center;
          width: 50px;
          height: 26px;

          i {
            font-size: 11px;
            height: 100%;
            display: flex;
            align-items: center;
            width: 50%;
            justify-content: center;
          }

          input {
            opacity: 0;
            width: 0;
            height: 0;

            &:focus + .slider {
              outline: none;
            }

            &:checked + .slider:before {
              transform: translateX(24px);
              transition: 0.1s;
            }
          }

          .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--primo-color-primogreen);
            transition: 0.4s;
            display: flex;
            align-items: center;

            &.code i.fa-edit {
              color: var(--primo-color-black);
            }

            &.code i.fa-code {
              color: white;
            }

            i {
              position: absolute;
              z-index: 1;
              color: var(--primo-color-black);

              &.fa-edit {
                left: 1px;
                bottom: 1px;
                color: white;
              }

              &.fa-code {
                right: 0;
                bottom: 1px;
              }
            }

            &:before {
              position: absolute;
              content: '';
              height: 20px;
              width: 20px;
              left: 3px;
              z-index: 1;
              background-color: var(--primo-color-black);
              transition: background-color 0.4s, transform 0.1s;
              box-shadow: 0px 0px 3px 0px rgb(0 0 0 / 50%);
            }

            &.round {
              border-radius: 34px;
            }

            &.round:before {
              border-radius: 50%;
            }
          }
        }
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
      border: 2px solid var(--primo-color-primogreen);
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
        box-shadow: var(--primo-ring-primored);
      }

      &:active {
        color: var(--primo-color-black);
        background: var(--primo-color-primogreen);
      }
    }

    &.switch {
      border: 2px solid var(--primo-color-primogreen);
      color: var(--primo-color-primogreen);
      outline-color: var(--primo-color-primogreen);

      &:hover {
        background: var(--primo-color-primogreen-dark);
        color: var(--primo-color-white);
        border-color: var(--primo-color-primogreen-dark);
      }
    }
  }

  button[disabled] {
    opacity: 0.25;
    transition: opacity 0.1s;
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
