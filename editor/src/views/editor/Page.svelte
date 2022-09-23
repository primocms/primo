<script>
  import { fade } from 'svelte/transition';
  import { find, isEqual } from 'lodash-es';
  import Block from './Layout/Block.svelte';
  import Spinner from '../../ui/misc/Spinner.svelte';
  import {
    content,
    pages,
    symbols,
    code as siteCode
    // html as siteHTML,
    // css as siteCSS,
  } from '../../stores/data/draft';
  import {locale} from '../../stores/app/misc'
  import {updatePreview} from '../../stores/actions'
  import {
    id as pageID,
    sections,
    fields as pageFields,
    code as pageCode
  } from '../../stores/app/activePage';
  import {
    processCode,
    processCSS,
    convertFieldsToData,
    wrapInStyleTags,
  } from '../../utils';
  import { getAllFields } from '../../stores/helpers';
  import { goto } from '$app/navigation';

  export let id = 'index'
  $: $pageID = id

  let element

  $: pageExists = findPage(id, $pages);
  function findPage(id, pages) {
    console.log({id})
    const [root] = id.split('/');
    const rootPage = find(pages, ['id', root]);
    const childPage = rootPage ? find(rootPage?.pages, ['id', id]) : null;
    return childPage || rootPage;
  }

  function hydrateInstance(block, symbols) {
    const symbol = find(symbols, ['id', block.symbolID]);
    return {
      ...symbol,
      id: block.id,
      type: block.type,
      symbolID: block.symbolID
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
  let cached = { pageCode: null, siteCode: null }
  $: setPageHTML({
    pageCode: $pageCode,
    siteCode: $siteCode
  });
  async function setPageHTML({ pageCode, siteCode }) {
    if (isEqual(pageCode, cached.pageCode) && isEqual(siteCode, cached.siteCode)) return
    cached.pageCode = pageCode
    cached.siteCode = siteCode
    pageMounted = false
    const css = await processCSS(siteCode.css + pageCode.css);
    const data = convertFieldsToData(getAllFields());
    const [head, below] = await Promise.all([
      processCode({
        code: {
          html: `<svelte:head>
            ${siteCode.html.head}${pageCode.html.head}
            ${wrapInStyleTags(css)}
          </svelte:head>`,
          css: '',
          js: '',
        },
        data,
      }),
      processCode({
        code: {
          html: siteCode.html.below + pageCode.html.below,
          css: '',
          js: '',
        },
        data,
      }),
    ]);
    htmlHead = !head.error ? head.html : '';
    htmlBelow = !below.error ? below.html : '';
    pageMounted = true
  }

  $: setPageContent(id, $pages);
  function setPageContent(id, pages) {
    console.log({id, pages})
    const [root, child] = id.split('/');
    const rootPage = find(pages, ['id', root]);
    if (rootPage && !child) {
      setPageStore(rootPage);
    } else if (rootPage && child) {
      const childPage = find(rootPage.pages, ['id', id]);
      if (childPage) setPageStore(childPage)
    } else {
      console.warn('Could not navigate to page', id);
    }
    updatePreview()

    function setPageStore(page) {
      sections.set(page.sections);
      pageFields.set(page.fields);
      pageCode.set(page.code);
    }
  }

  // Fade in page when all components mounted
  let pageMounted = false;
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
  class:fadein={pageMounted}
  lang={$locale}
>
  {#if pageExists}
    {#each $sections as block, i (block.id)}
      {#if block.symbolID}
        <Block
          block={hydrateInstance(block, $symbols)}
          {i}
        />
      {:else}
        <Block on:save {block} {i} />
      {/if}
    {:else}
        <Block block={{ type: 'options' }} />
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

    --Spinner-color: var(--primo-color-primogreen);
    --Spinner-color-opaque: rgba(248, 68, 73, 0.2);
  }
  .primo-page {
    transition: 0.1s opacity;
    opacity: 0;
    border-top: 0;
    margin-top: 86px;
  }

  .fadein {
    opacity: 1;
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