<script>
  import _ from 'lodash'
  import { fade } from "svelte/transition";
  import { SelectOne, TextInput } from "../../components/inputs";
  import { PrimaryButton } from "../../components/buttons";
  import PageItem from "./PageList/PageItem.svelte";
  import ModalHeader from "./ModalHeader.svelte";
  import {createUniqueID} from '../../utilities'

  import { createPage } from "../../const";
  import { makeValidUrl } from "../../utils";
  import {pages} from "../../stores/data/draft";
  import activePage from "../../stores/app/activePage";
  import {pages as actions} from "../../stores/actions";
  import {id} from '../../stores/app/activePage'

  async function submitForm(form) {
    let title = pageLabel
    let url = pageURL
    const isEmpty = pageBase === 'Empty'
    url = currentPath[0] ? `${currentPath[0]}/${url}` : url // prepend parent page to id (i.e. about/team)
    const newPage = isEmpty
      ? createPage(url, title)
      : duplicatePage(title, url);
    actions.add(newPage, currentPath)
    creatingPage = false;
    pageLabel = ''
    pageURL = ''
    pageBase = null
  }

  async function deletePage(pageId) {
    actions.delete(pageId, currentPath)
  }

  function duplicatePage(title, url) {
    const newPage = _.cloneDeep($activePage) 
    const [newContent, IDmap] = scrambleIds(newPage.content);
    newPage.content = newContent;
    newPage.title = title;
    newPage.id = url;

    // Replace all the old IDs in the page styles with the new IDs
    let rawPageStyles = newPage.styles.raw;
    let finalPageStyles = newPage.styles.final;
    IDmap.forEach(([oldID, newID]) => {
      newPage.styles.raw = rawPageStyles.replace(new RegExp(oldID, "g"), newID);
      newPage.styles.final = finalPageStyles.replace(
        new RegExp(oldID, "g"),
        newID
      );
    });

    return newPage;

    function scrambleIds(content) {
      let IDs = [];
      const newContent = content.map((block) => {
        const newID = createUniqueID();
        IDs.push([block.id, newID]);
        return {
          ...block,
          id: newID,
        };
      });
      return [newContent, IDs];
    }

  }

  let creatingPage = false;

  function validateUrl(url) {
    pageURL = url
      .replace(/\s+/g, "-")
      .replace(/[^0-9a-z\-._]/gi, "")
      .toLowerCase();
  }

  function editPage(pageId, args) {
    actions.update(pageId, page => ({
      ...page,
      ...args
    }))
  }

  function listPages(pageId) {
    const {pages} = _.find(listedPages, ['id', pageId])
    listedPages = pages
    currentPath = [ ...currentPath, pageId ]
  }

  function addSubPage(pageId) {
    currentPath = [ ...currentPath, pageId ]
    listedPages = []
    creatingPage = true;
  }

  let currentPath = $id.includes('/') ? [ $id.split('/')[0] ] : [] // load child route
  $: listedPages = getListedPages(currentPath, $pages)
  $: breadcrumbs = getBreadCrumbs(currentPath, $pages)

  function getListedPages(path, pages) {
    const [ rootPageId ] = path
    if (rootPageId) {
      const rootPage = _.find(pages, ['id', rootPageId])
      return rootPage.pages || []
    } else return pages
  }

  function getBreadCrumbs(path, pages) {
    const [ rootPageId ] = path
    if (rootPageId) {
      const rootPage = _.find(pages, ['id', rootPageId])
      return [
        {
          label: 'Site',
          path: []
        },
        {
          label: rootPage.title,
          path
        }
      ]
    } else return null
  }

  let pageLabel = ''
  let pageURL = ''
  $: if (!pageLabelEdited) {
    pageURL = makeValidUrl(pageLabel)
  }
  $: validateUrl(pageURL)
  let pageLabelEdited = false
  let pageBase
  $: disablePageCreation = !pageLabel || !pageURL

</script>

<ModalHeader icon="fas fa-th-large" title="Pages" />

{#if breadcrumbs}
  <div in:fade class="breadcrumbs">
    {#each breadcrumbs as {label, path}, i }
      <div class="breadcrumb" on:click={() => currentPath}>
        <button on:click={() => currentPath = path} class:underline={breadcrumbs.length !== i+1} class="font-semibold">{label}</button>
      </div>
    {/each}
  </div>
{/if}

<ul class="page-items xyz-in" xyz="fade stagger stagger-1">
  {#each listedPages as page (page.id)}
    <PageItem
      {page}
      parent={currentPath[0]}
      disableAdd={breadcrumbs}
      active={$id === page.id}
      on:edit={({detail}) => editPage(page.id, detail)} 
      on:add={() => addSubPage(page.id)} 
      on:delete={() => deletePage(page.id)} 
      on:list={() => listPages(page.id)}
    />
  {/each}
</ul>

{#if !creatingPage}
  <PrimaryButton
    on:click={() => (creatingPage = true)}
    id="new-page"
    icon="fas fa-plus mr-2">
    New Page
  </PrimaryButton>
{:else}
  <div class="p-4">
    <form on:submit|preventDefault={submitForm} in:fade={{ duration: 100 }}>
      <TextInput
        bind:value={pageLabel}
        id="page-label"
        autofocus={true}
        variants="mb-4"
        label="Page Label"
        placeholder="About Us" />
      <TextInput
        bind:value={pageURL}
        id="page-url"
        variants="mb-4"
        label="Page URL"
        prefix="/"
        on:input={() => pageLabelEdited = true}
        placeholder="about-us" />
      <SelectOne
        bind:selection={pageBase}
        id="page-base"
        variants="mb-8"
        label="Starting Point"
        options={['Empty', 'Duplicate']} />
      <PrimaryButton disabled={disablePageCreation} id="create-page" type="submit">Create</PrimaryButton>
    </form>
  </div>
{/if}


<style>
  ul.page-items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 1rem;
    margin-bottom: 1rem;
  }
  .breadcrumbs {
    display: flex;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 700;
    color: rgb(229, 231, 235);
  }
  .breadcrumb:not(:last-child):after {
    content: '/';
    @apply mx-2 no-underline;
  }
</style>