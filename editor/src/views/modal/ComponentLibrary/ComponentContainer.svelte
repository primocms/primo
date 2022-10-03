<script>
  import { createEventDispatcher, onMount, getContext } from 'svelte';
  import { chain as _chain } from 'lodash-es'
  import Icon from '@iconify/svelte'
  import { fade } from 'svelte/transition';
  const dispatch = createEventDispatcher();
  import { LoremIpsum } from "lorem-ipsum";
  import * as Popper from '@popperjs/core'
  import {getComponentData, getSymbolUseInfo} from '../../../stores/helpers'

  import IFrame from './IFrame.svelte';
  import {
    processCode,
    wrapInStyleTags,
  } from '../../../utils';
  import { code as siteCode } from '../../../stores/data/draft';
  import {
    // html as pageHTML,
    // css as pageCSS,
    code as pageCode
  } from '../../../stores/app/activePage';

  export let titleEditable = true
  export let symbol;
  export let name = symbol.name || '';
  export let buttons = [];
  export let hovering = false;
  export let action = null

  let height = localStorage.getItem(`symbol-height-${symbol.id}`) || 0;
  $: localStorage.setItem(`symbol-height-${symbol.id}`, height + 32);

  function changeName() {
    document.activeElement.blur();
    symbol.name = name;
    dispatch('update', symbol);
    editingTitle = false
  }

  let componentApp;
  let componentData
  let error;
  compileComponentCode(symbol);
  async function compileComponentCode(symbol) {
    componentData = getComponentData({ component: symbol })

    const res = await processCode({
      code: {
        ...symbol.code,
        html: `
        <svelte:head>
          ${$siteCode.html.head + $pageCode.html.head}
          ${wrapInStyleTags($siteCode.css + $pageCode.css)}
        </svelte:head>
        ${symbol.code.html}
        ${$siteCode.html.below + $pageCode.html.below}
        `,
      },
      data: componentData,
      buildStatic: false,
    });

    error = res.error;
    componentApp = res.js;
  }
  
  const info = getSymbolUseInfo(symbol.id)
  let button_node
  let tooltip_node
  $: if (tooltip_node) {
    Popper.createPopper(button_node, tooltip_node, {
      placement: 'top',
    });
  }

  let active;

  let editingTitle = false

  let header
  
  const hide_options = getContext('SIMPLE')

</script>


{#if buttons.length === 1 && action} <!-- make whole container a button -->
  <button
    in:fade={{ duration: 100 }}
    class="component-wrapper"
    id="component-{symbol.id}"
    style="height:{height + 32}px"
    on:click={() => {
      active = true;
      action.onclick();
    }}
    class:active
    >
    <IFrame bind:height {componentApp} {componentData} />
    {#if name}
      <header>
        <div class="component-label">
          <span>{name}</span>
        </div>
        {@html action.svg}
      </header>
    {/if}
    <div class="overlay">
      {#if !active}
        <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.5 5.625V6.375C9.5 6.52969 9.37344 6.65625 9.21875 6.65625H7.15625V8.71875C7.15625 8.87344 7.02969 9 6.875 9H6.125C5.97031 9 5.84375 8.87344 5.84375 8.71875V6.65625H3.78125C3.62656 6.65625 3.5 6.52969 3.5 6.375V5.625C3.5 5.47031 3.62656 5.34375 3.78125 5.34375H5.84375V3.28125C5.84375 3.12656 5.97031 3 6.125 3H6.875C7.02969 3 7.15625 3.12656 7.15625 3.28125V5.34375H9.21875C9.37344 5.34375 9.5 5.47031 9.5 5.625ZM12.3125 6C12.3125 9.21094 9.71094 11.8125 6.5 11.8125C3.28906 11.8125 0.6875 9.21094 0.6875 6C0.6875 2.78906 3.28906 0.1875 6.5 0.1875C9.71094 0.1875 12.3125 2.78906 12.3125 6ZM11.1875 6C11.1875 3.41016 9.08984 1.3125 6.5 1.3125C3.91016 1.3125 1.8125 3.41016 1.8125 6C1.8125 8.58984 3.91016 10.6875 6.5 10.6875C9.08984 10.6875 11.1875 8.58984 11.1875 6Z" fill="white"/>
        </svg>
      {/if}
      <span>{active && action.clicked ? action.clicked.label : action.label}</span>
    </div>
  </button>
{:else}
  <div
    in:fade={{ duration: 100 }}
    class="component-wrapper"
    id="component-{symbol.id}"
  >
    {#if action}
      <div class="primary-action" class:active>
        <button on:click={() => {
          active = true
          action.onclick()
        }}>
          <IFrame bind:height {componentApp} {componentData} />
          <div class="overlay">
            {#if !active}
              <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.5 5.625V6.375C9.5 6.52969 9.37344 6.65625 9.21875 6.65625H7.15625V8.71875C7.15625 8.87344 7.02969 9 6.875 9H6.125C5.97031 9 5.84375 8.87344 5.84375 8.71875V6.65625H3.78125C3.62656 6.65625 3.5 6.52969 3.5 6.375V5.625C3.5 5.47031 3.62656 5.34375 3.78125 5.34375H5.84375V3.28125C5.84375 3.12656 5.97031 3 6.125 3H6.875C7.02969 3 7.15625 3.12656 7.15625 3.28125V5.34375H9.21875C9.37344 5.34375 9.5 5.47031 9.5 5.625ZM12.3125 6C12.3125 9.21094 9.71094 11.8125 6.5 11.8125C3.28906 11.8125 0.6875 9.21094 0.6875 6C0.6875 2.78906 3.28906 0.1875 6.5 0.1875C9.71094 0.1875 12.3125 2.78906 12.3125 6ZM11.1875 6C11.1875 3.41016 9.08984 1.3125 6.5 1.3125C3.91016 1.3125 1.8125 3.41016 1.8125 6C1.8125 8.58984 3.91016 10.6875 6.5 10.6875C9.08984 10.6875 11.1875 8.58984 11.1875 6Z" fill="white"/>
              </svg>
            {/if}
            <span>{active && action.clicked ? action.clicked.label : action.label}</span>
          </div>
        </button>
      </div>
    {:else}
      <IFrame bind:height {componentApp} {componentData} />
    {/if}
    <header bind:this={header} class:has-action={action && buttons.length === 0}>
      <div class="component-label">
        {#if titleEditable}
          <form on:submit|preventDefault={changeName}>
            <!-- svelte-ignore a11y-label-has-associated-control -->
            <label on:click={() => editingTitle = true}>
              {#if name || editingTitle}
              <input type="text" bind:value={name} size={name.length} />
              {/if}
              {#if !editingTitle}
                <svg
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"><path
                  d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path
                  fill-rule="evenodd"
                  d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                  clip-rule="evenodd" /></svg>
              {/if}
            </label>
          </form>
          <span bind:this={button_node} class="info" title="Used {info.frequency} times on site">
            <Icon icon="akar-icons:info" width="1.25rem" height="100%" />
          </span>
          <div bind:this={tooltip_node} class="info-tooltip">
            <div id="arrow" data-popper-arrow></div>
            {#if info.frequency === 0}
              <span>Unused</span>
            {:else}
              <span>Used on {info.pages.join(', ')} {info.frequency} {info.frequency === 1 ? 'time' : 'times'}</span>
            {/if}
          </div>
        {:else if name}
          <div class="action-name">
            <span>{name}</span>
          </div>
        {/if}
      </div>
      {#if !hide_options}
        <div class="primo-buttons">
          {#each buttons as button}
            <button
              title={button.title}
              class:highlight={button.highlight && !active}
              on:mouseenter={() => {
                hovering = true;
              }}
              on:mouseleave={() => {
                hovering = false;
              }}
              on:click={button.onclick}>
              {#if active && button.clicked}
                <span>{button.clicked.label}</span>
                {@html button.clicked.svg}
              {:else}
                {#if button.label}<span class="label">{button.label}</span>{/if}
                {#if button.svg}
                  {@html button.svg}
                {:else if button.icon}<i class={button.icon} />{/if}
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </header>
  </div>
{/if}


<style lang="postcss">
  button.component-wrapper {
    display: flex;
    flex-direction: column;
  }

  .primary-action {
    position: relative;
    button {
      height: 100%;
      width: 100%;
    }
    .overlay {
      position: absolute;
      inset: 0;
      height: 100%;
    }
    &.active, &:hover {
      .overlay {
        opacity: 0.95;
      }
    }
  }

  .component-wrapper {
    position: relative;
    box-shadow: var(--primo-box-shadow);
    overflow: hidden;
    content-visibility: auto;
    color: var(--primo-color-white);
    border: 1px solid var(--color-gray-9);
    display: grid;
    grid-template-rows: 25vh auto;

    .overlay {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      background: var(--color-gray-8);
      z-index: 1;
      opacity: 0;
      transition: 0.1s opacity;

      svg {
        margin-right: 0.5rem;
      }
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--color-gray-8);
      padding: 0.5rem;

      :global(svg) {
        width: 1rem;
      }

      &.has-action {
        pointer-events: none;
      }

      .action-name {
        display: flex;
        justify-content: space-between;
        width: 100%;

        svg {
          width: 1rem;
          height: 1rem;
        }
      }

      .component-label {
        display: flex;
        align-items: center;
        flex: 1;
        padding-left: 0.5rem;

        form {
          display: flex;
          align-items: center;
          flex: 1;

          label {
            font-size: 0.85rem;
            height: 2rem;
            display: flex;
            align-items: center;
            cursor: pointer;
          }

          input {
            background: transparent;
            border: 0;
            padding: 0;
            font-weight: 700;
          }
          input:focus {
            box-shadow: none;
            outline: 0;
          }

          svg {
            height: 0.75rem;
            width: 0.75rem;
          }
        }

        span {
          font-weight: 700;
          font-size: 0.75rem;
        }
      }
      
      .info {
        padding: 0 1rem;
        font-size: 3rem;
        
        &:hover + .info-tooltip {
          opacity: 1;
        }
      }
      
      .info-tooltip {
        font-weight: 500;
        background: var(--color-gray-9);
        padding: 0.25rem 0.5rem;
        max-width: 250px;
        opacity: 0;
        transition: 0.1s opacity;
        pointer-events: none;
        translate: 0 -6px;
        
        [data-popper-arrow],
        [data-popper-arrow]::before {
          position: absolute;
          width: 8px;
          height: 8px;
          background: inherit;
        }
        
        [data-popper-arrow] {
          visibility: hidden;
          bottom: -4px;
        }
        
        [data-popper-arrow]::before {
          visibility: visible;
          content: '';
          transform: rotate(45deg);
        }
      }

      .primo-buttons {
        display: flex;
        gap: 0.5rem;

        button {
          background: var(--color-gray-7);
          display: flex;
          align-items: center;
          padding: 0.5rem;
          gap: 0.5rem;
          transition: var(--transition-colors);
          font-size: 0.75rem;
          border-radius: 2px;

          :global(svg) {
            width: 1rem;
            height: 1rem;
          }

          .label {
            margin-right: 0.25rem;
          }

          &:focus {
            outline: 0;
          }

          &.highlight {
            color: var(--primo-color-white);
            border: 1px solid var(--primo-color-brand);
          }

          &:hover {
            color: var(--primo-color-black);
            background: var(--primo-color-brand);
          }

          span {
            font-size: var(--font-size-2);
          }
        }
      }
    }
  }

</style>
