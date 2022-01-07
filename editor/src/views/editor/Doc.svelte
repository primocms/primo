<script>
  import { fade } from 'svelte/transition';
  import { find } from 'lodash-es';
  import Block from './Layout/Block.svelte';
  import Spinner from '../../ui/misc/Spinner.svelte';
  import {
    pages,
    symbols,
    fields as siteFields,
    html as siteHTML,
    css as siteCSS,
  } from '../../stores/data/draft';
  import {
    id as pageID,
    sections,
    fields as pageFields,
    html as pageHTML,
    css as pageCSS,
  } from '../../stores/app/activePage';
  import {
    processCode,
    processCSS,
    convertFieldsToData,
    wrapInStyleTags,
  } from '../../utils';
  import { getAllFields } from '../../stores/helpers';
  import { goto } from '$app/navigation';
  import {navigating} from '$app/stores'

  export let element;

  $: pageExists = findPage($pageID, $pages);
  function findPage(id, pages) {
    const [root] = id.split('/');
    const rootPage = find(pages, ['id', root]);
    const childPage = rootPage ? find(rootPage?.pages, ['id', id]) : null;
    return childPage || rootPage;
  }

  function hydrateInstance(block, symbols) {
    const symbol = find(symbols, ['id', block.symbolID]);
    return {
      ...block,
      value: {
        // copy the symbol's values (html,css,js,fields)
        ...symbol.value,
        // but overwrite the fields with the block's own field values (i.e. field data)
        fields: symbol.value.fields.map((symbolField) => {
          const originalField = find(block.value.fields, [
            'id',
            symbolField.id,
          ]) ||
            find(symbol.value.fields, ['id', symbolField.id]) || { value: '' };
          return {
            ...symbolField,
            fields: hydrateChildFields(originalField, symbolField),
            value: originalField.value,
          };
        }),
      },
    };

    function hydrateChildFields(originalField, symbolField) {
      if (symbolField.type === 'repeater') {
        return symbolField.fields;
      } else if (symbolField.type === 'group') {
        return symbolField.fields.map((symbolChildField) => ({
          ...symbolChildField,
          value:
            find(originalField.fields, ['id', symbolChildField.id])?.value ||
            symbolChildField.value,
        }));
      } else {
        return originalField.fields;
      }
    }
  }

  // Disable the links on the page that don't navigate to a page within primo
  async function disableLinks() {
    if (!element) return;
    const { pathname, origin } = window.location;
    const [site] = pathname.split('/').slice(1);
    const homeUrl = `${origin}/${site}`;
    element.querySelectorAll('a').forEach((link) => {

      // link is to primo.af
      if (window.location.host === link.host) {

        // link navigates to site home
        if (link.pathname === '/') {
          link.onclick = (e) => {
            e.preventDefault();
            // goto(homeUrl);
          };
          return;
        } 

        link.onclick = e => {
          e.preventDefault()
        }

        const [ linkPage ] = link.pathname.split('/').slice(1);

        // Link goes to current site
        const pageExists = !!find($pages, ['id', linkPage])

        link.onclick = (e) => {
          e.preventDefault();
          if (pageExists) {
            goto(`${homeUrl}/${linkPage}`);
          } 
        };

      } else {
        openLinkInNewWindow(link);
      }

      function openLinkInNewWindow(link) {
        link.onclick = (e) => {
          e.preventDefault();
          window.open(link.href, '_blank');
        };
      }
    });
  }
  $: pageMounted && disableLinks();

  let htmlHead = '';
  let htmlBelow = '';
  $: setPageHTML({
    siteHTML: $siteHTML,
    pageHTML: $pageHTML,
    siteCSS: $siteCSS,
    pageCSS: $pageCSS,
  });
  async function setPageHTML({ siteHTML, pageHTML, siteCSS, pageCSS }) {
    const css = await processCSS(siteCSS + pageCSS);
    const data = convertFieldsToData(getAllFields());
    const [head, below] = await Promise.all([
      processCode({
        code: {
          html: `<svelte:head>
            ${siteHTML.head}${pageHTML.head}
            ${wrapInStyleTags(css)}
          </svelte:head>`,
          css: '',
          js: '',
        },
        data,
      }),
      processCode({
        code: {
          html: siteHTML.below + pageHTML.below,
          css: '',
          js: '',
        },
        data,
      }),
    ]);
    htmlHead = !head.error ? head.html : '';
    htmlBelow = !below.error ? below.html : '';
  }

  // Fade in page when all components mounted
  let pageMounted = false;
  let componentsMounted = 0;
  $: nComponents = $sections.filter(
    (block) => block.type === 'component'
  ).length;

  $: if (element && componentsMounted >= nComponents) {
    pageMounted = true;
  } else if (componentsMounted < nComponents) {
    pageMounted = false;
  }

  // reset pageMounted on page change
  $: if ($navigating && ($navigating.from.path !== $navigating.to.path)) {
    pageMounted = false;
    componentsMounted = 0;
  }

  $: pageIsEmpty = $sections.length <= 1 && $sections.length !== 0 && $sections[0]['type'] === 'options'

</script>

<svelte:head>
  {@html htmlHead || ''}
</svelte:head>

{#if !pageMounted}
  <div class="spinner-container" out:fade={{ duration: 200 }}>
    <Spinner />
  </div>
{/if}
<div
  bind:this={element}
  class="primo-page being-edited"
>
  {#if pageExists}
    {#each $sections as block, i (block.id)}
      {#if block.symbolID}
        <Block
          on:mount={() => componentsMounted++}
          block={hydrateInstance(block, $symbols, $pageFields, $siteFields)}
          {i}
        />
      {:else}
        <Block on:save {block} {i} on:mount={() => componentsMounted++} />
      {/if}
    {/each}
  {/if}
</div>
{@html htmlBelow || ''}

{#if pageIsEmpty}
<div class="empty-state">
  if you're seeing this, <br>your website is empty
</div>
{/if}

<style lang="postcss">
  .spinner-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;

    --Spinner-color: var(--primo-color-primored);
    --Spinner-color-opaque: rgba(248, 68, 73, 0.2);
  }
  .primo-page {
    border-top: 0;
    transition: border-top 0.2s; /* match transition time in Toolbar.svelte */
    transition-delay: 1s;
  }

  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--color-gray-4);
    pointer-events: none;
    z-index: -2;
    font-family: Satoshi, sans-serif;
  }
</style>
