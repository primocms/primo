<script>
  import { Spinner } from '../../../components/misc';
  import { fade } from 'svelte/transition';
  import { createEventDispatcher, onMount } from 'svelte';
  import 'requestidlecallback-polyfill';

  const dispatch = createEventDispatcher();
  import { createSymbolPreview } from '../../../utils';

  import { styles as siteStyles, wrapper } from '../../../stores/data/draft';
  import { styles as pageStyles } from '../../../stores/app/activePage';
  import { getTailwindConfig } from '../../../stores/helpers';
  import { processors } from '../../../component';
  import { getAllFields } from '../../../stores/helpers';
  import components from '../../../stores/app/components';
  import { convertFieldsToData } from '../../../utils';

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

  let iframe;
  let iframeLoaded = false;

  let scale;
  let iframeContainer;
  function resizePreview() {
    const { clientWidth: parentWidth } = iframeContainer;
    const { clientWidth: childWidth } = iframe;
    scale = parentWidth / childWidth;
  }

  $: if (iframe) {
    resizePreview();
  }

  let mounted = false;
  let shouldLoadIframe = true;
  onMount(() => {
    mounted = true;
    shouldLoadIframe = true;
  });

  let css;
  $: mounted && processCSS(symbol.value.css);
  function processCSS(raw = '') {
    if (!raw) return;
    const cacheKey = symbol.id + raw; // to avoid getting html cached with irrelevant data
    const cachedCSS = $components[cacheKey];
    if (cachedCSS) {
      css = cachedCSS;
    } else {
      const tailwind = getTailwindConfig(true);
      const encapsulatedCss = `#component-${symbol.id} {${raw}}`;
      processors.css(encapsulatedCss, { tailwind }).then((res) => {
        css = res || '/**/';
        $components[raw] = css;
      });
    }
  }

  let html;
  $: mounted && processHTML(symbol.value.html);
  function processHTML(raw = '') {
    if (!raw) return;
    const cachedHTML = $components[raw];
    if (cachedHTML) {
      html = cachedHTML;
    } else {
      const allFields = getAllFields(symbol.value.fields);
      const data = convertFieldsToData(allFields);
      processors.html(raw, data).then((res) => {
        html = res;
        $components[raw] = html;
      });
    }
  }

  let js;
  $: mounted && processJS(symbol.value.js);
  function processJS(raw) {
    if (!raw) {
      js = `//`; // set js to something to component renders
    } else {
      const allFields = getAllFields(symbol.value.fields);
      const data = convertFieldsToData(allFields);
      const finalJS = `
        const primo = {
          id: '${symbol.id}',
          data: ${JSON.stringify(data)},
          fields: ${JSON.stringify(allFields)}
        }
        ${raw.replace(
          /(?:import )(\w+)(?: from )['"]{1}(?!http)(.+)['"]{1}/g,
          `import $1 from 'https://cdn.skypack.dev/$2'`
        )}`;
      js = finalJS;
    }
  }

  $: preview = buildPreview(html, css, js);
  function buildPreview(html, css, js) {
    if (!mounted || (!html && !js && !css)) return ``;
    const parentStyles = $siteStyles.final + $pageStyles.final;
    const previewCode = createSymbolPreview({
      id: symbol.id,
      html,
      wrapper: $wrapper,
      js,
      css: parentStyles + css,
      tailwind: getTailwindConfig(),
    });

    return previewCode;
  }

  let active = false;

</script>

<svelte:window on:resize={resizePreview} />
<div
  class="component-wrapper flex flex-col border border-gray-900 bg-codeblack text-white rounded"
  in:fade={{ delay: 250, duration: 200 }}
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
          class:focus={button.focus && !active}
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
  <div
    class="bg-gray-100 flex-1 flex flex-col relative"
    bind:this={iframeContainer}>
    {#if !iframeLoaded}
      <div
        class="loading bg-gray-900 w-full h-full left-0 top-0 absolute flex justify-center items-center z-50">
        <Spinner />
      </div>
    {/if}
    {#if loadPreview}
      <iframe
        on:load={() => (iframeLoaded = true)}
        class:fadein={iframeLoaded}
        style="transform: scale({scale})"
        class="w-full shadow-lg"
        bind:this={iframe}
        title="component preview"
        srcdoc={preview} />
    {/if}
  </div>
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
  button.focus {
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
  }

</style>
