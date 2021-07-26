<script>
  import { createEventDispatcher, onMount } from 'svelte';
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
  export let loadPreview = true;
  export let hovering = false;

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
  class="component-wrapper flex flex-col border border-gray-900 bg-codeblack text-white rounded"
  id="symbol-{symbol.id}">
  <div class="flex justify-between items-center shadow-sm">
    <div class="component-label">
      {#if titleEditable}
        <form class="cursor-pointer" on:submit|preventDefault={changeTitle}>
          <svg
            class="w-4 h-4 mr-1"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"><path
              d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
            <path
              fill-rule="evenodd"
              d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
              clip-rule="evenodd" /></svg>
          <input class="cursor-pointer" type="text" bind:value={title} />
        </form>
      {:else}<span>{title}</span>{/if}
    </div>
    <div class="flex">
      {#each buttons as button}
        <button
          title={button.title}
          class="p-2 {button.class}"
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
            <span
              class="mr-2 text-sm font-semibold">{button.clicked.label}</span>
            {@html button.clicked.svg}
          {:else}
            {#if button.label}
              <span class="mr-2 text-sm font-semibold">{button.label}</span>
            {/if}
            {@html button.svg}
          {/if}
        </button>
      {/each}
    </div>
  </div>
  <IFrame {componentApp} />
</div>

<style>
  .component-wrapper {
    @apply relative shadow;
    height: 40vh;
    overflow: hidden;
    content-visibility: auto;
  }
  button {
    @apply bg-codeblack;
    @apply flex space-x-2 items-center transition-colors duration-100 focus:outline-none focus:opacity-75;
  }
  button.highlight {
    @apply bg-primored;
  }
  button:hover {
    @apply bg-gray-800;
  }
  .buttons {
    @apply flex justify-end;
  }
  iframe {
    @apply w-full opacity-0 transition-opacity duration-200;
    height: 300vw;
    transform-origin: top left;
  }
  .fadein {
    @apply opacity-100;
  }
  .message-header {
    @apply flex justify-between items-center bg-gray-100 p-1;
  }
  .component-label {
    @apply flex items-center flex-1 pl-2;

    form {
      display: flex;
      align-items: center;
      flex: 1;
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
    }

    span {
      padding: 0.25rem 0;
      font-size: 0.75rem;
    }
  }

</style>
