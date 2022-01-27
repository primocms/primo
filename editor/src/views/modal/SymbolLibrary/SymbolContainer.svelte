<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { chain as _chain } from 'lodash-es'
  import { fade } from 'svelte/transition';
  const dispatch = createEventDispatcher();

  import IFrame from './IFrame.svelte';
  import { getAllFields } from '../../../stores/helpers';
  import {
    convertFieldsToData,
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
  export let title = symbol.title || '';
  export let buttons = [];
  export let hovering = false;
  export let action = null

  let height = localStorage.getItem(`symbol-height-${symbol.id}`) || 0;
  $: localStorage.setItem(`symbol-height-${symbol.id}`, height + 32);

  function changeTitle(e) {
    document.activeElement.blur();
    symbol.title = title;
    dispatch('update', symbol);
    editingTitle = false
  }

  let componentApp;
  let error;
  compileComponentCode(symbol);
  async function compileComponentCode(symbol) {
    // const allFields = getAllFields(symbol.fields);
    // const data = convertFieldsToData(allFields);
    // TODO: add dummy data

    const data = _chain(symbol.fields.map(field => ({
      ...field,
      value: 'Some dummy text'
    })))
      .keyBy('key')
      .mapValues('value')
      .value();

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
      data,
      buildStatic: false,
    });

    error = res.error;
    componentApp = res.js;
  }

  let active;

  let editingTitle = false

  let header

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
    <IFrame bind:height {componentApp} />
    {#if title}
      <header>
        <div class="component-label">
          <span>{title}</span>
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
    style="height:{height + 32}px"
  >
    {#if action}
      <button on:click={() => {
        active = true
        action.onclick()
      }} class="primary-action" class:active style="height: calc(100% - {header ? header.clientHeight : 0}px">
        <IFrame bind:height {componentApp} />
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
      <IFrame bind:height {componentApp} />
    {/if}
    <header bind:this={header} class:has-action={action && buttons.length === 0}>
      <div class="component-label">
        {#if titleEditable}
          <form on:submit|preventDefault={changeTitle}>
            <!-- svelte-ignore a11y-label-has-associated-control -->
            <label on:click={() => editingTitle = true}>
              {#if title || editingTitle}
              <input type="text" bind:value={title} size={title.length} />
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
        {:else if title}
          <div class="action-title">
            <span>{title}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
          </div>
        {/if}
      </div>
      <div class="buttons">
        {#each buttons as button}
          <button
            title={button.title}
            class:selected={active}
            class:highlight={button.highlight && !active}
            on:mouseenter={() => {
              hovering = true;
            }}
            on:mouseleave={() => {
              hovering = false;
            }}
            on:click={() => {
              active = true;
              button.onclick();
            }}>
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
    </header>
  </div>
{/if}


<style lang="postcss">
  button.component-wrapper {
    display: flex;
    flex-direction: column;
  }

  .primary-action {
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
    max-height: 50vh;
    min-height: 10rem;

    .overlay {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: calc(100% - 32px);
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
      box-shadow: var(--box-shadow);
      background: var(--color-gray-8);
      position: absolute;
      bottom: 0;
      z-index: 2;
      width: 100%;
      padding: 0.5rem;

      :global(svg) {
        width: 1rem;
      }

      &.has-action {
        pointer-events: none;
      }

      .action-title {
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
            width: 100%;
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

      .buttons {
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

          &.selected {
            pointer-events: none;
            opacity: 0.75;
            outline: 0;
          }

          .label {
            margin-right: 0.25rem;
          }

          &:focus {
            outline: 0;
          }

          &.highlight {
            background: var(--primo-color-primored);
          }

          &:hover {
            background: transparent;
          }

          span {
            font-size: var(--font-size-2);
          }
        }
      }
    }
  }

</style>
