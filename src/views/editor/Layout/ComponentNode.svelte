<script>
  import { cloneDeep } from 'lodash';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { router } from 'tinro';
  import { getStyles, appendHtml } from '../pageUtils.js';
  import { processors } from '../../../component';
  import { getAllFields, getTailwindConfig } from '../../../stores/helpers';
  import components from '../../../stores/app/components';
  import { convertFieldsToData, processCode } from '../../../utils';

  export let block;

  let mounted = false;
  onMount(() => (mounted = true));

  // $: appendJS(block.value.js, mounted);
  // function appendJS(js, mounted) {
  //   if (mounted && js) {
  //     const allFields = getAllFields(block.value.fields);
  //     const data = convertFieldsToData(allFields);
  //     const finalJS = `
  //       const primo = {
  //         id: '${block.id}',
  //         data: ${JSON.stringify(data)},
  //         fields: ${JSON.stringify(allFields)}
  //       }
  //       ${js.replace(
  //         /(?:import )(\w+)(?: from )['"]{1}(?!http)(.+)['"]{1}/g,
  //         `import $1 from 'https://cdn.skypack.dev/$2'`
  //       )}`;
  //     appendHtml(`#component-${block.id} > [primo-js]`, 'script', finalJS, {
  //       type: 'module',
  //     });
  //     $components[js] = finalJS;
  //   }
  // }

  // let html = '';
  // $: processHTML(block.value.html);
  // function processHTML(raw = '') {
  //   const cacheKey = raw + JSON.stringify(block.value.fields); // to avoid getting html cached with irrelevant data
  //   const cachedHTML = $components[cacheKey];
  //   if (!block.symbolID && cachedHTML) {
  //     html = cachedHTML;
  //   } else {
  //     const allFields = getAllFields(block.value.fields);
  //     const data = {
  //       id: block.id,
  //       ...convertFieldsToData(allFields),
  //     };
  //     processors.html(raw, data).then(async (res) => {
  //       html = res;
  //       $components[cacheKey] = html;
  //     });
  //   }
  // }

  // let css = '';
  // $: processCSS(block.value.css);
  // function processCSS(raw = '') {
  //   const cacheKey = block.id + raw; // to avoid getting CSS w/ wrong encapsulation
  //   const cachedCSS = $components[cacheKey];
  //   if (cachedCSS) {
  //     css = cachedCSS;
  //   } else if (raw) {
  //     const tailwind = getTailwindConfig(true);
  //     const encapsulatedCss = `#component-${block.id} {${raw}}`;
  //     processors.css(encapsulatedCss, { tailwind }).then((res) => {
  //       css = res;
  //       $components[cacheKey] = css;
  //     });
  //   } else {
  //     css = ``;
  //   }
  // }

  let html = '';
  let css = '';
  let js = '';
  $: compileComponentCode({
    html: block.value.html,
    css: block.value.css,
    js: block.value.js,
  });

  async function compileComponentCode({ html, css, js }) {
    const data = {
      id: block.id,
      ...convertFieldsToData(getAllFields(block.value.fields)),
    };
    const res = await processCode({ html, css, js }, data);
    if (component) component.$destroy();
    const blob = new Blob([res], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);

    const { default: App } = await import(url /* @vite-ignore */);
    component = new App({
      target: node,
      props: {
        ...data,
      },
    });
    // $components[cacheKey] = html;
  }

  let node;
  let component;

</script>

<div
  bind:this={node}
  class="component {block.symbolID ? `symbol-${block.symbolID}` : ''}"
  id="component-{block.id}"
  transition:fade={{ duration: 100 }} />

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
  .component > div {
    @apply w-full;
  }

</style>
