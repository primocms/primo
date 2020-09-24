<script>
  import cloneDeep from "lodash/cloneDeep";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import ShortUniqueId from "short-unique-id";
  import { SelectOne, TextInput } from "../../components/inputs";
  import { PrimaryButton } from "../../components/buttons";
  import { Card } from "../../components/misc";
  import PageItem from "./PageList/PageItem.svelte";
  import ModalHeader from "./ModalHeader.svelte";

  import { createPage } from "../../const";
  // import site from "../../stores/data/site";
  import {pages} from "../../stores/data/draft";
  import pageData from "../../stores/data/pageData";
  import {id} from '../../stores/app/activePage'

  function getUniqueId() {
    return new ShortUniqueId().randomUUID(5).toLowerCase();
  }


  async function submitForm(form) {
    const inputs = Object.values(form.target);
    const [title, url] = inputs.map((f) => f.value);
    const isEmpty = inputs[2].classList.contains("selected");
    const newPage = isEmpty
      ? createPage(url, title)
      : duplicatePage($pageData, title, url);
    $pages = [ ...$pages, newPage ]
    creatingPage = false;
    pageUrl = "";
  }

  async function deletePage(pageId) {
    $pages = $pages.filter(p => p.id !== pageId)
  }

  function duplicatePage(page, title, url) {
    const newPage = cloneDeep(page);
    const [newContent, IDmap] = scrambleIds(page.content);
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

    function getUniqueId() {
      return new ShortUniqueId().randomUUID(5).toLowerCase();
    }
  }

  let creatingPage = false;

  let pageBeingCreated;
  let pageBeingDeleted;

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
</script>

<style>
  li {
    @apply list-none;
  }
</style>

<ModalHeader icon="fas fa-th-large" title="Pages" />

<ul class="grid grid-cols-2 gap-4 mb-4">
  {#each $pages as page (page.id)}
    <li transition:fade={{ duration: 200 }} id="page-{page.id}">
      <PageItem
        {page}
        active={$id === page.id}
        on:delete={() => deletePage(page.id)} />
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
