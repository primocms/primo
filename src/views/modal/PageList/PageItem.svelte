<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  import { TextInput } from '../../../components/inputs';
  import { PrimaryButton } from '../../../components/buttons';
  import Preview from '../../../components/misc/Preview.svelte';

  import { router } from 'tinro';
  import modal from '../../../stores/app/modal';
  import { buildStaticPage } from '../../../stores/helpers';
  import { site } from '../../../stores/data/draft';
  import 'requestidlecallback-polyfill';

  export let page;
  export let active = false;
  export let disableAdd = false;
  export let displayOnly = false;

  let preview = '';
  $: if (page) buildPreview();
  async function buildPreview() {
    preview = await buildStaticPage({ page, site: $site });
  }

  function openPage(e) {
    e.preventDefault();
    modal.hide();

    const [_, user, repo] = $router.path.split('/');

    if (user === 'try') {
      router.goto(`/try/${page.id === 'index' ? '' : page.id}`);
    } else {
      router.goto(`/${user}/${repo}/${page.id === 'index' ? '' : page.id}`);
    }
  }

  let editingPage = false;
  let title = page.title || '';
  let id = page.id || '';
  $: disableSave = !title || !id;

</script>

<div class="page-item">
  <div class="page-info">
    <div>
      <span class="title">{page.title}</span>
      <span class="subtitle">{page.id === 'index' ? '' : page.id}</span>
    </div>
    {#if !displayOnly}
      <div class="buttons">
        <button title="Edit" on:click={() => (editingPage = !editingPage)}>
          <i class="fas fa-edit" />
        </button>
        {#if page.pages && !disableAdd}
          <button title="Show sub-pages" on:click={() => dispatch('list')}>
            <i class="fas fa-th-large" />
          </button>
        {:else if page.id !== 'index' && !disableAdd}
          <button title="Add sub-page" on:click={() => dispatch('add')}>
            <i class="fas fa-plus" />
          </button>
        {/if}
        {#if page.id !== 'index'}
          <button
            title="Delete page"
            on:click={() => dispatch('delete')}
            class="delete">
            <i class="fas fa-trash" />
          </button>
        {/if}
      </div>
    {/if}
  </div>
  <div class="page-body">
    {#if editingPage}
      <form
        on:submit|preventDefault={() => {
          editingPage = false;
          dispatch('edit', { title, id });
        }}
        in:fade={{ duration: 100 }}>
        <TextInput
          bind:value={title}
          id="page-label"
          autofocus={true}
          label="Page Label"
          placeholder="About Us" />
        {#if id !== 'index'}
          <TextInput
            bind:value={id}
            id="page-url"
            label="Page URL"
            prefix="/"
            placeholder="about-us" />
        {/if}
        <PrimaryButton disabled={disableSave} id="save-page" type="submit">
          Save
        </PrimaryButton>
      </form>
    {:else if displayOnly}
      <div class="page-link">
        <div class="page-container">
          <Preview {preview} preventClicks={true} />
        </div>
      </div>
    {:else}
      <a
        tinro-ignore
        class="page-link"
        href="/{page.id}"
        on:click={openPage}
        class:active
        aria-label="Go to /{page.id}">
        <div class="page-container">
          <Preview {preview} preventClicks={true} />
        </div>
      </a>
    {/if}
  </div>
</div>

<style lang="postcss">
  .page-item {
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius-1);
    overflow: hidden;
    position: relative;

    .page-info {
      color: var(--color-gray-2);
      background: var(--color-codeblack);
      width: 100%;
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;

      .title {
        font-size: var(--font-size-2);
        font-weight: 600;
        margin-bottom: 0;
      }

      .subtitle {
        font-size: var(--font-size-2);
        font-weight: 400;
        color: var(--color-gray-5);
        margin-bottom: 0;
        &:before {
          content: '/';
          padding-right: 1px;
        }
      }

      .buttons {
        display: flex;
        justify-content: flex-end;

        button {
          padding: 4px;
          font-size: var(--font-size-1);
          transition: var(--transition-colors);

          &:hover {
            color: var(--color-primored);
          }

          &:focus {
            outline: 0;
          }
        }

        button.delete {
          margin-left: 4px;
          padding: 1px;
          font-size: var(--font-size-1);
          color: var(--color-gray-3);
        }
      }
    }

    .page-body {
      height: 0;
      padding-top: calc(100% - 37px); /* include header in square */
      position: relative;
      .page-link {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: var(--color-white);
        display: block;
        width: 100%;
        overflow: hidden;
        transition: var(--transition-colors);

        &.active {
          cursor: default;
          pointer-events: none;
          opacity: 0.5;

          &:after {
            opacity: 0.5;
          }
        }

        .page-container {
          all: unset;
          height: 100%;
          z-index: -1; /* needed for link */
        }
      }
      a.page-link {
        &:hover {
          opacity: 0.5;
        }
      }
    }

    form {
      margin: 16px;
      position: absolute;
      inset: 0;

      --TextInput-mb: 0.5rem;
    }
  }

</style>
