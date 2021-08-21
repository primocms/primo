<script>
  import { fade } from 'svelte/transition';
  import { find, last } from 'lodash';
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
    content,
    fields as pageFields,
    html as pageHTML,
    css as pageCSS,
  } from '../../stores/app/activePage';
  import {
    processCode,
    convertFieldsToData,
    wrapInStyleTags,
  } from '../../utils';
  import { getAllFields } from '../../stores/helpers';
  import { router } from 'tinro';

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
    // overwrite the symbol field values
    return {
      ...block,
      value: {
        ...symbol.value,
        fields: symbol.value.fields.map((field) => {
          const originalField = find(block.value.fields, ['id', field.id]) ||
            find(symbol.value.fields, ['id', field.id]) || { value: '' };
          return {
            ...field,
            fields:
              field.type === 'repeater' ? field.fields : originalField.fields,
            value: originalField.value,
          };
        }),
      },
    };
  }

  // Disable the links on the page that don't navigate to a page within primo
  async function disableLinks() {
    const { pathname, origin } = window.location;
    const [username, site] = pathname.split('/').slice(1);
    const homeUrl = `${origin}/${username}/${site}`;
    element.querySelectorAll('a').forEach((link) => {
      if (window.location.host === link.host) {
        // link is to primo.af

        // link navigates to site home
        if (link.pathname === '/') {
          link.setAttribute('data-tinro-ignore', '');
          link.onclick = (e) => {
            e.preventDefault();
            router.goto(homeUrl);
          };
          return;
        }

        const [_, linkUsername, linkSite, linkPage, childPage] =
          link.pathname.split('/');

        if (linkUsername !== username) {
          openLinkInNewWindow(link);
        } else {
          const pageExists = find($pages, ['id', linkPage]);
          if (!pageExists) {
            openLinkInNewWindow(link);
          } else {
            link.setAttribute('data-tinro-ignore', '');
            link.onclick = (e) => {
              e.preventDefault();
              router.goto(`${homeUrl}/${linkPage}`);
            };
          }
        }
      } else {
        openLinkInNewWindow(link);
      }

      function openLinkInNewWindow(link) {
        link.setAttribute('data-tinro-ignore', '');
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
    const data = convertFieldsToData(getAllFields());
    const [head, below] = await Promise.all([
      processCode({
        code: {
          html: `<svelte:head>
            ${siteHTML.head}${pageHTML.head}
            ${wrapInStyleTags(siteCSS + pageCSS)}
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

    htmlHead = head.html;
    htmlBelow = below.html;
  }

  // Fade in page when all components mounted
  let pageMounted = false;
  let componentsMounted = 0;
  $: nComponents = $content.filter(
    (block) => block.type === 'component'
  ).length;

  $: if (element && componentsMounted >= nComponents) {
    pageMounted = true;
  } else if (componentsMounted < nComponents) {
    pageMounted = false;
  }

  // reset pageMounted on page change
  $: if ($router.from !== $router.url) {
    pageMounted = false;
    componentsMounted = 0;
  }

</script>

<svelte:head>
  {@html htmlHead}
</svelte:head>

{#if !pageMounted}
  <div class="spinner-container" out:fade={{ duration: 200 }}>
    <Spinner />
  </div>
{/if}
<div bind:this={element} class="primo-page" class:fadein={pageMounted}>
  {#if pageExists}
    {#each $content as block, i (block.id)}
      {#if block.symbolID}
        <Block
          on:mount={() => componentsMounted++}
          block={hydrateInstance(block, $symbols, $pageFields, $siteFields)}
          {i} />
      {:else}
        <Block {block} {i} />
      {/if}
    {/each}
  {/if}
</div>
{@html htmlBelow}

<style>
  .spinner-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;

    --Spinner-color: var(--color-primored);
    --Spinner-color-opaque: rgba(248, 68, 73, 0.2);
  }
  .primo-page {
    opacity: 0;
  }
  .fadein {
    transition: opacity 0.1s;
    opacity: 1;
  }

</style>
