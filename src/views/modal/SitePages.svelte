<script>
  import _ from 'lodash';
  import { fade } from 'svelte/transition';
  import { TextInput } from '../../components/inputs';
  import SplitButton from '../../ui/inputs/SplitButton.svelte';
  import { PrimaryButton } from '../../components/buttons';
  import PageItem from './PageList/PageItem.svelte';
  import ModalHeader from './ModalHeader.svelte';
  import { createUniqueID } from '../../utilities';

  import { createPage } from '../../const';
  import { makeValidUrl } from '../../utils';
  import { pages } from '../../stores/data/draft';
  import activePage from '../../stores/app/activePage';
  import { pages as actions } from '../../stores/actions';
  import { id } from '../../stores/app/activePage';

  async function submitForm(form) {
    let title = pageLabel;
    let url = pageURL;
    const isEmpty = pageBase === 'Empty';
    url = currentPath[0] ? `${currentPath[0]}/${url}` : url; // prepend parent page to id (i.e. about/team)
    const newPage = isEmpty
      ? createPage(url, title)
      : duplicatePage(title, url);
    actions.add(newPage, currentPath);
    creatingPage = false;
    pageLabel = '';
    pageURL = '';
    pageBase = null;
  }

  async function deletePage(pageId) {
    actions.delete(pageId, currentPath);
  }

  function duplicatePage(title, url) {
    const newPage = _.cloneDeep($activePage);
    const [newContent] = scrambleIds(newPage.content);
    newPage.content = newContent;
    newPage.title = title;
    newPage.id = url;
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
    const { pages } = _.find(listedPages, ['id', pageId]);
    listedPages = pages;
    currentPath = [...currentPath, pageId];
  }

  function addSubPage(pageId) {
    currentPath = [...currentPath, pageId];
    listedPages = [];
    creatingPage = true;
  }

  let currentPath = $id.includes('/') ? [$id.split('/')[0]] : []; // load child route
  $: listedPages = getListedPages(currentPath, $pages);
  $: breadcrumbs = getBreadCrumbs(currentPath, $pages);

  function getListedPages(path, pages) {
    const [rootPageId] = path;
    if (rootPageId) {
      const rootPage = _.find(pages, ['id', rootPageId]);
      return rootPage.pages || [];
    } else return pages;
  }

  function getBreadCrumbs(path, pages) {
    const [rootPageId] = path;
    if (rootPageId) {
      const rootPage = _.find(pages, ['id', rootPageId]);
      return [
        {
          label: 'Site',
          path: [],
        },
        {
          label: rootPage.title,
          path,
        },
      ];
    } else return null;
  }

  let pageLabel = '';
  let pageURL = '';
  $: if (!pageLabelEdited) {
    pageURL = makeValidUrl(pageLabel);
  }
  $: validateUrl(pageURL);
  let pageLabelEdited = false;
  let pageBase;
  $: disablePageCreation = !pageLabel || !pageURL;

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
            on:input={() => (pageLabelEdited = true)}
            placeholder="about-us" />
          <SplitButton
            bind:selection={pageBase}
            buttons={[{ id: 'Empty' }, { id: 'Duplicate' }]} />
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
    padding: 0.5rem;
    background: var(--color-black);
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
        grid-template-columns: repeat(2, 50%);
      }

      @media (max-width: 600px) {
        grid-template-columns: auto;
      }

      li.create-page {
        box-shadow: var(--ring);

        button {
          background: var(--color-gray-9);
          color: var(--color-white);
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          transition: var(--transition-colors);
          &:hover {
            background: var(--color-primored);
          }
          svg {
            width: 1rem;
            height: 1rem;
            margin-bottom: 0.5rem;
          }
        }

        form {
          padding: 1rem;

          --TextInput-mb: 10px;
        }

        --SplitButton-mb: 1rem;
      }
    }
  }

</style>
