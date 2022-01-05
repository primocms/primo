<script>
  import { cloneDeep, find } from 'lodash-es';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import { TextInput } from '../../components/inputs';
  import { PrimaryButton } from '../../components/buttons';
  import PageItem from './PageList/PageItem.svelte';
  import ModalHeader from './ModalHeader.svelte';
  import { createUniqueID } from '../../utilities';

  import { Page } from '../../const';
  import { makeValidUrl } from '../../utils';
  import { pages } from '../../stores/data/draft';
  import activePage from '../../stores/app/activePage';
  import { pages as actions } from '../../stores/actions';
  import { id } from '../../stores/app/activePage';

  let shouldDuplicatePage = true

  async function finishCreatingPage() {
    let name = pageName;
    let url = pageURL;
    const isEmpty = !shouldDuplicatePage;
    url = currentPath[0] ? `${currentPath[0]}/${url}` : url; // prepend parent page to id (i.e. about/team)
    const newPage = isEmpty
      ? Page(url, name)
      : duplicatePage(name, url);
    actions.add(newPage, currentPath);
    creatingPage = false;
    pageName = '';
    pageURL = '';
    shouldDuplicatePage = true;
  }

  async function deletePage(pageId) {
    actions.delete(pageId, currentPath);
  }

  function duplicatePage(name, url) {
    const newPage = cloneDeep($activePage);
    const [newSections] = scrambleIds(newPage.sections);
    newPage.sections = newSections;
    newPage.name = name;
    newPage.id = url;
    return newPage;

    function scrambleIds(sections) {
      let IDs = [];
      const newSections = sections.map((block) => {
        const newID = createUniqueID();
        IDs.push([block.id, newID]);
        return {
          ...block,
          id: newID,
        };
      });
      return [newSections, IDs];
    }
  }

  let creatingPage = false;

  function validateUrl(url) {
    pageURL = url
      .replace(/\s+/g, '-')
      .replace(/[^0-9a-z\-._]/gi, '')
      .toLowerCase();
  }

  function editPage(pageId, args) {
    actions.update(pageId, (page) => ({
      ...page,
      ...args,
    }));
  }

  function listPages(pageId) {
    const { pages } = find(listedPages, ['id', pageId]);
    listedPages = pages;
    currentPath = [...currentPath, pageId];
  }

  function addSubPage(pageId) {
    currentPath = [...currentPath, pageId];
    listedPages = [];
    creatingPage = true;
  }

  let currentPath = buildCurrentPath($page.url.pathname);
  $: rootPageId = currentPath[0];
  $: childPageId = currentPath[1];
  $: listedPages = getListedPages(childPageId, $pages);
  $: breadcrumbs = getBreadCrumbs(childPageId, $pages);

  function buildCurrentPath(path) {
    const [site, root, child] = path.slice(1).split('/');
    if (!root || !child) {
      // on index or top-level page
      return [];
    } else return [root, child];
  }

  function getListedPages(childPageId, pages) {
    if (childPageId) {
      const rootPage = find(pages, ['id', rootPageId]);
      return rootPage.pages || [];
    } else return pages;
  }

  function getBreadCrumbs(childPageId, pages) {
    if (childPageId) {
      const rootPage = find(pages, ['id', rootPageId]);
      return [
        {
          label: 'Site',
          path: [],
        },
        {
          label: rootPage.name,
          path: currentPath,
        },
      ];
    } else return null;
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

<ModalHeader icon="fas fa-th-large" title="Pages" />

<main>
  {#if breadcrumbs}
    <div in:fade class="breadcrumbs">
      {#each breadcrumbs as { label, path }, i}
        <div class="breadcrumb">
          {#if i === breadcrumbs.length - 1}
            <span>{label}</span>
          {:else}
            <button on:click={() => (currentPath = path)}>{label}</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <ul class="page-items" xyz="fade stagger stagger-1">
    {#each listedPages as page (page.id)}
      <li class="xyz-in">
        <PageItem
          {page}
          parent={currentPath[0]}
          disableAdd={breadcrumbs}
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clip-rule="evenodd" />
          </svg>
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
              <span>Duplicate current page</span>
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
</main>

<style lang="postcss">
  main {
    padding: 0.5rem 1rem;
    background: var(--primo-color-black);
    overflow-y: scroll;
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
    ul.page-items {
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
          border: 2px solid var(--primo-color-primored);
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
              color: var(--primo-color-primored);
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
  }

</style>
