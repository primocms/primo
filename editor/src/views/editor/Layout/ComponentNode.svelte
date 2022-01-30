<script>
  import _ from 'lodash-es';
  import { createEventDispatcher } from 'svelte';
  import { processCode } from '../../../utils';
  import { id as pageID, fields as pageFields } from '../../../stores/app/activePage';
  import site, { fields as siteFields, symbols } from '../../../stores/data/draft';
  import {locale} from '../../../stores/app/misc'

  const dispatch = createEventDispatcher();

  export let block;
  export let node;

  $: symbol = _.find($symbols, ['id', block.symbolID])

  $: siteContent = $site.content[$locale]
  $: pageContent = siteContent[$pageID]
  $: componentContent = pageContent?.[block.id] || {}

  $: componentData = buildData(componentContent, block.fields)

  $: allContent = [ componentContent, pageContent, siteContent ]
  $: allFields = [ block.fields, $pageFields, $siteFields ]

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

  $: hydrateComponent(allContent, allFields);
  async function hydrateComponent(content, fields) {
    if (!component) return
    component.$set(componentData);
  }

  function buildData(content, fields) {
    const keyValues = fields.map(field => ({
      key: field.key,
      value: content[field.key]
    }))

    const asObj = _.chain(keyValues)
      .keyBy('key')
      .mapValues('value')
      .value();
    return asObj
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