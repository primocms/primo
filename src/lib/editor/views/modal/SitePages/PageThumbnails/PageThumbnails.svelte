<script lang="ts">
  import { fade } from 'svelte/transition'
  import Icon from '@iconify/svelte'
  import { find } from 'lodash-es'
  import PageItem from './Item.svelte'
  import { TextInput } from '../../../../components/inputs'
  import { PrimaryButton } from '../../../../components/buttons'
  import { pages as actions } from '../../../../stores/actions'
  import activePage, { url } from '../../../../stores/app/activePage'
  import { makeValidUrl } from '../../../../utils'
  import { Page } from '../../../../const'
  import pages from '$lib/editor/stores/data/pages'
  import { page } from '$app/stores'

  let shouldDuplicatePage = true

  async function finishCreatingPage() {
    let name = pageName
    let url = pageURL
    url = currentPath[0] ? `${currentPath[0]}/${url}` : url // prepend parent page to id (i.e. about/team)
    if (shouldDuplicatePage) {
      await actions.duplicate({
        page: $activePage,
        path: currentPath,
        details: { name, id: url },
      })
    } else {
      await actions.add(Page(url, name), currentPath)
    }

    creatingPage = false
    pageName = ''
    pageURL = ''
    shouldDuplicatePage = true
  }

  async function deletePage(page_id) {
    actions.delete(page_id)
    listedPages = listedPages.filter((page) => page.id !== page_id)
  }

  let creatingPage = false

  function validateUrl(url) {
    pageURL = url
      .replace(/\s+/g, '-')
      .replace(/[^0-9a-z\-._]/gi, '')
      .toLowerCase()
  }

  function editPage(page_url, args: { name: string; id: string }) {
    actions.edit(page_url, args)
  }

  function addSubPage(page_id) {
    list_pages(page_id)
    currentPath = [page_id]
    creatingPage = true
  }

  let currentPath = buildCurrentPath($url)
  $: root_page_url = currentPath[0]

  let listedPages = []
  list_pages($page.data.page)

  // $: $pages, list_pages(root_page_url) // update listed pages when making page store updates

  function list_pages(page = null, list_children = false) {
    if (!list_children) {
      listedPages = $pages.filter((p) => p.parent === page.parent)
    } else {
      listedPages = $pages.filter((p) => p.parent === page.id)
    }
  }

  $: breadcrumbs = getBreadCrumbs(root_page_url)
  function getBreadCrumbs(root_page_url) {
    if (root_page_url) {
      const root_page = find($pages, ['id', $page.data.page.parent])
      return [
        {
          label: 'Site',
          page: $pages.find((p) => p.url === 'index'),
        },
        {
          label: root_page.name,
          page: root_page,
        },
      ]
    } else return null
  }

  function buildCurrentPath(pagePath = '') {
    const [root, child] = pagePath.split('/')
    if (!root || !child) {
      // on index or top-level page
      return []
    } else return [root, child]
  }

  let pageName = ''
  let pageURL = ''
  $: if (!pageLabelEdited) {
    pageURL = makeValidUrl(pageName)
  }
  $: validateUrl(pageURL)
  let pageLabelEdited = false
  $: disablePageCreation = !pageName || !pageURL
</script>

{#if breadcrumbs}
  <div class="breadcrumbs">
    {#each breadcrumbs as { label, page }, i}
      {@const is_last = i === breadcrumbs.length - 1}
      <div class="breadcrumb">
        {#if is_last}
          <span>{label}</span>
        {:else}
          <button on:click={() => list_pages(page)}>{label}</button>
        {/if}
      </div>
    {/each}
  </div>
{/if}
<ul class="page-thumbnails">
  {#each listedPages as page, i (page.id)}
    {@const has_children = $pages.some((p) => p.parent === page.id)}
    <li data-page-i={i}>
      <PageItem
        {page}
        {has_children}
        disableAdd={!!breadcrumbs}
        active={$url === page.url}
        on:edit={({ detail }) => editPage(page.url, detail)}
        on:add={() => addSubPage(page.url)}
        on:delete={() => deletePage(page.id)}
        on:list={() => list_pages(page, true)}
      />
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
        in:fade={{ duration: 100 }}
      >
        <TextInput
          bind:value={pageName}
          id="page-label"
          autofocus={true}
          label="Page Label"
          placeholder="About Us"
        />
        <TextInput
          bind:value={pageURL}
          id="page-url"
          label="Page URL"
          prefix="/"
          on:input={() => (pageLabelEdited = true)}
          placeholder="about-us"
        />
        <div id="duplicate">
          <label>
            <input bind:checked={shouldDuplicatePage} type="checkbox" />
            <span>Duplicate active page</span>
          </label>
        </div>
        <PrimaryButton
          disabled={disablePageCreation}
          id="create-page"
          type="submit"
        >
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
