<script>
  import { isEqual, differenceWith } from 'lodash';
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { getAllFields, getTailwindConfig } from '../../../stores/helpers';
  import { convertFieldsToData, processCode } from '../../../utils';

  const dispatch = createEventDispatcher();

  export let block;

  let mounted = false;
  onMount(() => (mounted = true));

  let html = '';
  let css = '';
  let js = '';
  let fields = [];
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

  let cachedFields = [];
  $: hydrateComponent(block.value.fields);
  async function hydrateComponent(fields) {
    if (!component) return;
    if (differenceWith(fields, cachedFields, isEqual).length > 0) {
      cachedFields = fields;
      const data = convertFieldsToData(getAllFields(fields));
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

<div
  bind:this={node}
  class="component {block.symbolID ? `symbol-${block.symbolID}` : ''}"
  id="component-{block.id}"
  transition:fade={{ duration: 100 }} />
<div>
  {@html error}
</div>

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

</style>
