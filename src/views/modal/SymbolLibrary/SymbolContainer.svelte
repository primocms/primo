<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import 'requestidlecallback-polyfill';

  const dispatch = createEventDispatcher();

  import IFrame from './IFrame.svelte';
  import { getAllFields } from '../../../stores/helpers';
  import {
    convertFieldsToData,
    processCode,
    wrapInStyleTags,
  } from '../../../utils';
  import { html as siteHTML, css as siteCSS } from '../../../stores/data/draft';
  import {
    html as pageHTML,
    css as pageCSS,
  } from '../../../stores/app/activePage';

  export let symbol;
  export let title = symbol.title || '';
  export let buttons = [];
  export let titleEditable;
  export let hovering = false;

  let height = localStorage.getItem(`symbol-height-${symbol.id}`) || 0;
  $: localStorage.setItem(`symbol-height-${symbol.id}`, height + 32);

  function changeTitle(e) {
    document.activeElement.blur();
    symbol.title = title;
    dispatch('update', symbol);
  }

  let componentApp;
  let error;
  compileComponentCode(symbol.value);
  async function compileComponentCode(value) {
    const allFields = getAllFields(value.fields);
    const data = convertFieldsToData(allFields);
    const res = await processCode({
      code: {
        ...value,
        html: `
        <svelte:head>
          ${$siteHTML + $pageHTML}
          ${wrapInStyleTags($siteCSS + $pageCSS)}
        </svelte:head>
        ${value.html}
        `,
      },
      data,
      buildStatic: false,
    });
    error = res.error;
    componentApp = res.js;
  }

  let active;

</script>

<div
  in:fade={{ duration: 100 }}
  class="component-wrapper"
  id="symbol-{symbol.id}"
  style="height:{height + 32}px">
  <header>
    <div class="component-label">
      {#if titleEditable}
        <form on:submit|preventDefault={changeTitle}>
          <svg
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"><path
              d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
            <path
              fill-rule="evenodd"
              d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
              clip-rule="evenodd" /></svg>
          <input type="text" bind:value={title} />
        </form>
      {:else}<span>{title}</span>{/if}
    </div>
    <div class="buttons">
      {#each buttons as button}
        <button
          title={button.title}
          class={button.class}
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
            {#if button.label}<span>{button.label}</span>{/if}
            {@html button.svg}
          {/if}
        </button>
      {/each}
    </div>
  </header>
  <IFrame bind:height {componentApp} />
</div>

<style lang="postcss">
  .component-wrapper {
    position: relative;
    box-shadow: var(--box-shadow);
    storedheight: 40vh;
    overflow: hidden;
    content-visibility: auto;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-gray-9);
    background: var(--color-codeblack);
    color: var(--color-white);
    border-radius: var(--border-radius-1);

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--box-shadow);

      .component-label {
        display: flex;
        align-items: center;
        flex: 1;
        padding-left: 8px;

        form {
          display: flex;
          align-items: center;
          flex: 1;
          cursor: pointer;
          input {
            width: 100%;
            background: transparent;
            border: 0;
            padding: 0;
            font-size: 0.85rem;
          }
          input:focus {
            box-shadow: none;
          }

          svg {
            width: 16px;
            storedheight: 16px;
            margin-right: 4px;
          }
        }

        span {
          padding: 0.25rem 0;
          font-size: 0.75rem;
        }
      }

      .buttons {
        display: flex;
        justify-content: flex-end;

        button {
          background: var(--color-codeblack);
          display: flex;
          align-items: center;
          padding: 8px;
          transition: var(--transition-colors);

          &:focus {
            outline: 0;
            opacity: 0.75;
          }

          &.highlight {
            background: var(--color-primored);
          }

          &:hover {
            background: var(--color-gray-8);
          }

          span {
            margin-right: 8px;
            font-size: var(--font-size-2);
            font-weight: 600;
          }
        }
      }
    }
  }

</style>
