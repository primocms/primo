<script>
  import _ from 'lodash'
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { SelectOne, TextInput } from "../../components/inputs";
  import { PrimaryButton } from "../../components/buttons";
  import { Card } from "../../components/misc";
  import PageItem from "./PageList/PageItem.svelte";
  import ModalHeader from "./ModalHeader.svelte";
  import {getUniqueId} from '../../utils'

  import { createPage } from "../../const";
  import {pages} from "../../stores/data/draft";
  import activePage from "../../stores/app/activePage";
  import {pages as actions} from "../../stores/actions";
  import {id} from '../../stores/app/activePage'

  async function submitForm(form) {
    const inputs = Object.values(form.target);
    const [title, url] = inputs.map((f) => f.value);
    const isEmpty = inputs[2].classList.contains("selected");
    const newPage = isEmpty
      ? createPage(url, title)
      : duplicatePage(title, url);
    actions.add(newPage, currentPath)
    creatingPage = false;
    pageUrl = "";
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

    // Replace all the old IDs in the components
    IDmap.forEach(([oldID, newID]) => {
      newPage.content = newPage.content.map((section) => ({
        ...section,
        columns: section.columns.map((column) => ({
          ...column,
          rows: column.rows.map((row) =>
            row.type === "component"
              ? {
                  ...row,
                  value: {
                    ...row.value,
                    raw: {
                      ...row.value.raw,
                      css: row.value.raw.css.replace(
                        new RegExp(oldID, "g"),
                        newID
                      ),
                    },
                    final: {
                      ...row.value.final,
                      css: row.value.final.css.replace(
                        new RegExp(oldID, "g"),
                        newID
                      ),
                    },
                  },
                }
              : row
          ),
        })),
      }));
    });
    return newPage;

    function scrambleIds(content) {
      let IDs = [];
      const newContent = content.map((section) => {
        const newID = getUniqueId();
        IDs.push([section.id, newID]);
        return {
          ...section,
          id: newID,
          columns: section.columns.map((column) => {
            const newID = getUniqueId();
            IDs.push([column.id, newID]);
            return {
              ...column,
              id: newID,
              rows: column.rows.map((row) => {
                const newID = getUniqueId();
                IDs.push([row.id, newID]);
                return {
                  ...row,
                  id: newID,
                };
              }),
            };
          }),
        };
      });
      return [newContent, IDs];
    }

  }

  let creatingPage = false;

  let mounted = false;
  onMount(async () => {
    mounted = true;
  });

  function validateUrl({ detail }) {
    let validUrl;
    if (detail) {
      validUrl = detail
        .replace(/\s+/g, "-")
        .replace(/[^0-9a-z\-._]/gi, "")
        .toLowerCase();
    } else {
      validUrl = "";
    }
    pageUrl = validUrl;
  }

  let pageUrl = "";

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

  let currentPath = []
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

</script>

<ModalHeader icon="fas fa-th-large" title="Pages" />

{#if breadcrumbs}
  <div in:fade class="breadcrumbs flex text-sm p-2 font-bold text-gray-700">
    {#each breadcrumbs as {label, path}, i }
      <div class="breadcrumb" on:click={() => currentPath}>
        <button on:click={() => currentPath = path} class:underline={breadcrumbs.length !== i+1} class="font-semibold">{label}</button>
      </div>
    {/each}
  </div>
{/if}

<ul class="grid grid-cols-2 gap-4 mb-4">
  {#each listedPages as page (page.id)}
    <li in:fade={{ duration: 200 }} id="page-{page.id}">
      <PageItem
        {page}
        parent={currentPath[0]}
        disableAdd={breadcrumbs}
        active={$id === page.id}
        on:add={() => addSubPage(page.id)} 
        on:delete={() => deletePage(page.id)} 
        on:list={() => listPages(page.id)}
      />
    </li>
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
  <Card variants="p-4 shadow">
    <form on:submit|preventDefault={submitForm} in:fade={{ duration: 100 }}>
      <TextInput
        id="page-label"
        autofocus={true}
        variants="mb-4"
        label="Page Label"
        placeholder="About Us" />
      <TextInput
        id="page-url"
        variants="mb-4"
        label="Page URL"
        prefix="/"
        on:input={validateUrl}
        bind:value={pageUrl}
        placeholder="about-us" />
      <SelectOne
        id="page-base"
        variants="mb-8"
        label="Page Base"
        options={['Empty', 'Duplicate']} />
      <PrimaryButton id="create-page" type="submit">Create</PrimaryButton>
    </form>
  </Card>
{/if}


<style>
  .breadcrumb:not(:last-child):after {
    content: '/';
    @apply mx-2 no-underline;
  }
  li {
    @apply list-none;
  }
</style>