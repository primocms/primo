<script lang="ts">
    import {fade} from 'svelte/transition'
    import Icon from '@iconify/svelte'
    import {find} from 'lodash-es'
    import PageItem from './Item.svelte'
    import { TextInput } from '../../../../components/inputs';
    import { PrimaryButton } from '../../../../components/buttons';
    import { pages as actions } from '../../../../stores/actions';
    import activePage, { id } from '../../../../stores/app/activePage';
    import { makeValidUrl } from '../../../../utils';
    import { Page } from '../../../../const';
    import { id as siteID, pages as sitePages } from '../../../../stores/data/draft';

    let shouldDuplicatePage = true

    async function finishCreatingPage() {
      let name = pageName;
      let url = pageURL;
      url = currentPath[0] ? `${currentPath[0]}/${url}` : url; // prepend parent page to id (i.e. about/team)
      if (shouldDuplicatePage) {
        await actions.duplicate({
          page: $activePage,
          path: currentPath,
          details: { name, id: url }
        })
      } else {
        await actions.add(Page(url, name), currentPath);
      }
      
      creatingPage = false;
      pageName = '';
      pageURL = '';
      shouldDuplicatePage = true;
    }

    async function deletePage(pageId) {
      actions.delete(pageId, currentPath);
    }

    let creatingPage = false;

    function validateUrl(url) {
      pageURL = url
        .replace(/\s+/g, '-')
        .replace(/[^0-9a-z\-._]/gi, '')
        .toLowerCase();
    }

    function editPage(pageId, args: { name: string, id: string }) {
      actions.edit(pageId, args)
    }

    function addSubPage(pageId) {
      listPages(pageId)
      currentPath = [pageId];
      creatingPage = true;
    }

    let currentPath = buildCurrentPath($id);
    $: rootPageId = currentPath[0];

    let listedPages = $sitePages
    listPages(currentPath[0]) // list initial pages
    $: $sitePages, listPages(rootPageId) // update listed pages when making page store updates

    function listPages(pageId = null) {
      if (!pageId) { // root page
        listedPages = $sitePages
        currentPath = []
      } else {
        listedPages = find($sitePages, ['id', pageId])['pages']
        currentPath = [pageId];
      }
    }

    $: breadcrumbs = getBreadCrumbs(rootPageId);
    function getBreadCrumbs(rootPageId) {
      if (rootPageId) {
        const rootPage = find($sitePages, ['id', rootPageId]);
        return [
          {
            label: 'Site',
            id: null,
          },
          {
            label: rootPage.name,
            path: rootPage.id,
          },
        ];
      } else return null;
    }

    function buildCurrentPath(pagePath = '') {
      const [root, child] = pagePath.split('/');
      if (!root || !child) { // on index or top-level page
        return [];
      } else return [root, child];
    }

    let pageName = '';
    let pageURL = '';
    $: if (!pageLabelEdited) {
      pageURL = makeValidUrl(pageName);
    }
    $: validateUrl(pageURL);
    let pageLabelEdited = false;
    $: disablePageCreation = !pageName || !pageURL;

</script>

{#if breadcrumbs}
<div in:fade class="breadcrumbs">
  {#each breadcrumbs as { label, id }, i}
    <div class="breadcrumb">
      {#if i === breadcrumbs.length - 1}
        <span>{label}</span>
      {:else}
        <button on:click={() => listPages(id)}>{label}</button>
      {/if}
    </div>
  {/each}
</div>
{/if}
<ul class="page-thumbnails" xyz="fade stagger stagger-1">
  {#each listedPages as page, i}
    <li class="xyz-in" data-page-i={i}>
      <PageItem
        {page}
        disableAdd={!!breadcrumbs}
        active={$id === page.id}
        on:edit={({ detail }) => editPage(page.id, detail)}
        on:add={() => addSubPage(page.id)}
        on:delete={() => deletePage(page.id)}
        on:list={() => listPages(page.id)} />
    </li>
  {/each}
  <li class="create-page xyz-in">
    {#if !creatingPage}
      <button on:click={() => (creatingPage = true)}>
        <Icon icon="akar-icons:plus" />
        <span>Create Page</span>
      </button>
    {:else}
      <form
        on:submit|preventDefault={finishCreatingPage}
        in:fade={{ duration: 100 }}>
        <TextInput
          bind:value={pageName}
          id="page-label"
          autofocus={true}
          label="Page Label"
          placeholder="About Us" />
        <TextInput
          bind:value={pageURL}
          id="page-url"
          label="Page URL"
          prefix="/"
          on:input={() => (pageLabelEdited = true)}
          placeholder="about-us" />
        <div id="duplicate">
          <label>
            <input bind:checked={shouldDuplicatePage} type="checkbox">
            <span>Duplicate active page</span>
          </label>
        </div>
        <PrimaryButton
          disabled={disablePageCreation}
          id="create-page"
          type="submit">
          Create
        </PrimaryButton>
      </form>
    {/if}
  </li>
</ul>

<style lang="postcss">
  .breadcrumbs {
    display: flex;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 700;
    color: rgb(229, 231, 235);
    margin-bottom: 1rem;

    .breadcrumb:not(:last-child) {
      button {
        text-decoration: underline;
        font-weight: 600;
      }
      &:after {
        content: '/';
        padding: 0 0.5rem;
      }
    }
  }
  ul.page-thumbnails {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-gap: 1rem;
    margin-bottom: 1rem;

    @media (max-width: 900px) {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 600px) {
      grid-template-columns: auto;
    }

    li.create-page {
      button {
        padding: 3rem;
        border: 2px solid var(--primo-color-brand);
        border-radius: var(--primo-border-radius);
        background: var(--primo-color-black);
        color: var(--primo-color-white);
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        transition: 0.1s filter, 0.1s color;
        
        &:hover {
          filter: brightness(1.1);
          svg {
            color: var(--primo-color-brand);
          }
        }
        svg {
          width: 1rem;
          height: 1rem;
          margin-bottom: 0.5rem;
        }
      }

      form {
        background: var(--primo-color-codeblack);
        padding: 1rem;

        --TextInput-label-font-size: 0.75rem;
        --TextInput-mb: 0.75rem;

        #duplicate {
          color: var(--primo-color-white);
          margin-bottom: 1rem;

          input {
            margin-right: 0.5rem;
          }
        }
      }

      --SplitButton-mb: 1rem;
    }
  }
</style>