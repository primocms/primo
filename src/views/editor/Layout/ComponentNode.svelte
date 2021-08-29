<script>
  import { isEqual, differenceWith } from 'lodash';
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { getAllFields } from '../../../stores/helpers';
  import { convertFieldsToData, processCode } from '../../../utils';
  import { fields as pageFields } from '../../../stores/app/activePage';
  import { fields as siteFields } from '../../../stores/data/draft';

  const dispatch = createEventDispatcher();

  export let block;

  let mounted = false;
  onMount(() => (mounted = true));

  let html = '';
  let css = '';
  let js = '';
  $: compileComponentCode({
    html: block.value.html,
    css: block.value.css,
    js: block.value.js,
  });

  let error = '';
  async function compileComponentCode(rawCode) {
    // workaround for this function re-running anytime something changes on the page
    // (as opposed to when the code actually changes)
    if (html !== rawCode.html || css !== rawCode.css || js !== rawCode.js) {
      html = rawCode.html;
      css = rawCode.css;
      js = rawCode.js;
      const data = convertFieldsToData(getAllFields(block.value.fields));
      const res = await processCode({
        code: rawCode,
        data,
        buildStatic: false,
      });
      if (res.error) {
        error = res.error;
      } else if (res.js) {
        error = '';
        if (component) component.$destroy();
        const blob = new Blob([res.js], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);

        const { default: App } = await import(url /* @vite-ignore */);
        component = new App({
          target: node,
          props: data,
        });
      }
    }
  }

  let cachedBlockFields = [];
  let cachedPageFields = [];
  let cachedSiteFields = [];
  $: hydrateComponent(block.value.fields, $pageFields, $siteFields);
  async function hydrateComponent(blockFields, pageFields, siteFields) {
    if (!component) return;
    const blockFieldsChanged =
      differenceWith(blockFields, cachedBlockFields, isEqual).length > 0;
    const pageFieldsChanged =
      differenceWith(pageFields, cachedPageFields, isEqual).length > 0;
    const siteFieldsChanged =
      differenceWith(siteFields, cachedSiteFields, isEqual).length > 0;

    if (blockFieldsChanged || pageFieldsChanged || siteFieldsChanged) {
      cachedBlockFields = blockFields;
      cachedPageFields = pageFields;
      cachedSiteFields = siteFields;
      const data = convertFieldsToData(getAllFields(blockFields));
      component.$set(data);
    }
  }

  let node;
  let component;

  // Fade in component on mount
  const observer = new MutationObserver(() => {
    dispatch('mount');
  });

  $: if (node) {
    observer.observe(node, {
      childList: true,
    });
  }

  $: if (error) {
    dispatch('mount');
  }

</script>

{#if !error}
  <div
    bind:this={node}
    class="component {block.symbolID ? `symbol-${block.symbolID}` : ''}"
    id="component-{block.id}"
    transition:fade={{ duration: 100 }} />
{:else}
  <pre>
    {@html error}
  </pre>
{/if}

<style>
  .component {
    position: relative;
    outline: 5px solid transparent;
    outline-offset: -5px;
    transition: outline-color 0.2s;
    outline-color: transparent;
    width: 100%;
    min-height: 2rem;
  }

  pre {
    margin: 0;
    padding: 1rem;
    background: var(--primo-color-black);
    color: var(--color-gray-3);
    border: 1px solid var(--color-gray-6);
  }

</style>
