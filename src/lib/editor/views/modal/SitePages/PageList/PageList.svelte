<script>
  import { fade } from 'svelte/transition'
  import Item from './Item.svelte'
  import { PrimaryButton } from '../../../../components/buttons'
  import { TextInput } from '../../../../components/inputs'
  import pages from '$lib/editor/stores/data/pages'
  import { pages as actions } from '../../../../stores/actions'
  import { id as activePageID } from '../../../../stores/app/activePage'
  import { makeValidUrl } from '../../../../utils'
  import { Page } from '../../../../const'
  import { page } from '$app/stores'

  let currentPath = []
  $: root_page = currentPath[0]

  /**
   * @param {string} page_id
   * @param {{ name: string, url: string }} args
   */
  function edit_page(page_id, args) {
    actions.edit(page_id, args)
  }

  async function delete_page(page_id) {
    actions.delete(page_id)
  }

  function add_subpage(page) {
    currentPath = [page]
    creating_page = false
    creating_subpage = page.id
  }

  // Page Creation
  let creating_page = false
  let creating_subpage
  let shouldDuplicatePage = true
  let pageName = ''
  let pageURL = ''

  $: if (!pageLabelEdited) {
    pageURL = makeValidUrl(pageName)
  }
  $: validate_url(pageURL)
  let pageLabelEdited = false
  $: disablePageCreation = !pageName || !pageURL
  function validate_url(url) {
    pageURL = url
      .replace(/\s+/g, '-')
      .replace(/[^0-9a-z\-._]/gi, '')
      .toLowerCase()
  }

  async function finish_creating_page() {
    let name = pageName
    let url = pageURL
    url = currentPath[0] ? `${currentPath[0]['url']}/${url}` : url // prepend parent page to id (i.e. about/team)
    if (shouldDuplicatePage) {
      await actions.duplicate({
        page: $page.data.page,
        details: { name, url, parent: root_page?.id },
      })
    } else {
      await actions.add(Page({ url, name, parent: root_page?.id }))
    }

    creating_page = false
    creating_subpage = false
    pageName = ''
    pageURL = ''
    shouldDuplicatePage = true
  }
</script>

<ul class="page-list root">
  {#each $pages.filter((p) => !p.parent) as page, i}
    {@const children = $pages.filter((p) => p.parent === page.id)}
    <li>
      <Item
        {page}
        {children}
        active={$activePageID === page.id}
        on:edit={({ detail }) => edit_page(page.id, detail)}
        on:add={({ detail: page }) => add_subpage(page)}
        on:delete={({ detail: page }) => delete_page(page.id)}
      >
        {#if creating_subpage === page.id}
          <form
            on:submit|preventDefault={() => {
              currentPath = [page]
              finish_creating_page()
            }}
            in:fade={{ duration: 100 }}
          >
            <TextInput
              bind:value={pageName}
              id="page-label"
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
      </Item>
    </li>
  {/each}
  {#if creating_page}
    <li>
      <form
        on:submit|preventDefault={() => {
          currentPath = []
          finish_creating_page()
        }}
        in:fade={{ duration: 100 }}
      >
        <TextInput
          bind:value={pageName}
          id="page-label"
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
            <span>Duplicate active page</span>
            <input bind:checked={shouldDuplicatePage} type="checkbox" />
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
    </li>
  {/if}
</ul>
{#if !creating_page}
  <PrimaryButton
    on:click={() => (creating_page = true)}
    label="Create Page"
    icon="akar-icons:plus"
  />
{/if}

<style lang="postcss">
  ul.page-list {
    display: grid;
    color: var(--primo-color-white);
    background: #1a1a1a;
    border-radius: var(--primo-border-radius);
    margin-bottom: 1rem;

    &.root > li:not(:first-child) {
      border-top: 1px solid #222;
    }
  }
  #duplicate label {
    display: flex;
    gap: 0.5rem;
    margin: 0.25rem 0;
  }
  form {
    padding: 0.25rem;
    display: grid;
    gap: 0.5rem;
    max-width: 450px;
    padding: 0.825rem 1.125rem;
    margin-bottom: 0.5rem;
  }
</style>
