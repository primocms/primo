<script>
  import _, { isEqual, differenceWith } from 'lodash-es';
  import { createEventDispatcher } from 'svelte';
  import { getAllFields } from '../../../stores/helpers';
  import { convertFieldsToData, processCode } from '../../../utils';
  import { fields as pageFields } from '../../../stores/app/activePage';
  import { fields as siteFields } from '../../../stores/data/draft';

  const dispatch = createEventDispatcher();

  export let block;
  export let node;

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
      const dataWithFixedImages = await replaceImagesWithBase64(data);
      const res = await processCode({
        code: rawCode,
        data: dataWithFixedImages,
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
          props: dataWithFixedImages,
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
      const dataWithFixedImages = await replaceImagesWithBase64(data);
      component.$set(dataWithFixedImages);
    }
  }

  async function replaceImagesWithBase64(data) {
    // Modify final request by replacing all img url's beginning with 'primo:' -
    // Download file from supabase, then convert to Base64 and replace url value
    // let finalRequest = buildFinalRequest()
    const modifiedData = _.cloneDeep(data);
    await Promise.all(
      Object.entries(data).map(async (field) => {
        const [key, val] = field;
        if (val.url && val.url.startsWith('primo:')) {
          // Image type
          const b64 = await fetchAndConvert(val.url);
          modifiedData[key] = {
            ...modifiedData[key],
            url: b64,
            src: b64,
          };
        } else if (
          typeof val === 'object' &&
          !Array.isArray(val) &&
          key !== 'page' &&
          key !== 'site'
        ) {
          // Group type
          await Promise.all(
            Object.entries(val).map(async (subfield) => {
              const [subfieldKey, subfieldVal] = subfield;
              if (
                subfieldVal &&
                subfieldVal.url &&
                subfieldVal.url.startsWith('primo:')
              ) {
                // Image type
                const b64 = await fetchAndConvert(subfieldVal.url);
                modifiedData[key] = {
                  ...modifiedData[key],
                  [subfieldKey]: {
                    ...subfieldVal,
                    url: b64,
                    src: b64,
                  },
                };
              }
            })
          );
        } else if (Array.isArray(val)) {
          // Repeater type
          let newRepeaters = [];
          await Promise.all(
            val.map(async (subfield) => {
              await Promise.all(
                Object.entries(subfield).map(async (repeaterItem) => {
                  const [repeaterKey, repeaterVal] = repeaterItem;
                  if (repeaterVal.url && repeaterVal.url.startsWith('primo:')) {
                    // Image type
                    const b64 = await fetchAndConvert(repeaterVal.url);
                    subfield = {
                      ...subfield,
                      [repeaterKey]: {
                        ...repeaterVal,
                        url: b64,
                        src: b64,
                      },
                    };
                  }
                })
              );
              newRepeaters = [...newRepeaters, subfield];
            })
          );
          modifiedData[key] = newRepeaters;
        }
      })
    );
    return modifiedData;
  }

  async function fetchAndConvert(url) {
    // const imageKey = url.slice(12); // remove primo:sites/
    // const cached = await idb.get(imageKey);
    // return cached || url;
  }

  let component;

  let mounted;
  // Fade in component on mount
  const observer = new MutationObserver(() => {
    mounted = true;
    dispatch('mount');
  });

  $: if (node) {
    observer.observe(node, {
      childList: true,
    });
  }

  $: if (error) {
    mounted = true;
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
