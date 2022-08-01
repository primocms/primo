<script>
  import _ from 'lodash-es';
  import { createEventDispatcher, getContext } from 'svelte';
  import { processCode } from '../../../utils';
  import { site as unsavedSite, content, symbols } from '../../../stores/data/draft';
  import {locale} from '../../../stores/app/misc'
  import {getComponentData} from '../../../stores/helpers'

  const dispatch = createEventDispatcher();

  export let block;
  export let node;
  export let site = $unsavedSite;

  const is_preview = getContext('is-preview')

  $: symbol = _.find(is_preview ? site.symbols : $symbols, ['id', block.symbolID])
  $: $content, $locale, block, setComponentData()

  let componentData
  function setComponentData() {
    componentData = getComponentData({ component: block, loc: $locale, site: is_preview ? site : $unsavedSite })
  }

  let html = '';
  let css = '';
  let js = '';
  $: compileComponentCode(symbol.code);

  let error = '';
  async function compileComponentCode(rawCode) {
    // workaround for this function re-running anytime something changes on the page
    // (as opposed to when the code actually changes)
    if (html !== rawCode.html || css !== rawCode.css || js !== rawCode.js) {
      html = rawCode.html;
      css = rawCode.css;
      js = rawCode.js;
      const res = await processCode({
        code: rawCode,
        data: componentData,
        buildStatic: false,
      });
      if (res.error) {
        error = res.error;
      } else if (res.js) {
        error = '';
        if (component) component.$destroy();
        const blob = new Blob([res.js], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);

        const { default: App } = await import(/* @vite-ignore */ url);
        component = new App({
          target: node,
          props: componentData,
        });
      }
    }
  }

  $: hydrateComponent(componentData);
  async function hydrateComponent(data) {
    if (!component) return
    else if (error) {
      error = null
      compileComponentCode(symbol.code)
    } else {
      // TODO: re-render the component if `data` doesn't match its fields (e.g. when removing a component field to add to the page)
      component.$set(data);
    }
  }


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

{#if error}
  <pre>
    {@html error}
  </pre>
{/if}

<style>
  pre {
    margin: 0;
    padding: 1rem;
    background: var(--primo-color-black);
    color: var(--color-gray-3);
    border: 1px solid var(--color-gray-6);
  }
</style>