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

  let preview = '';
  buildPreview();
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

<li>
  <div class="page-info">
    <div><span class="title">{page.title}</span></div>
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
  </div>
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
  {:else}
    <a
      tinro-ignore
      class="page-container"
      href="/{page.id}"
      on:click={openPage}
      class:active
      aria-label="Go to /{page.id}">
      <Preview {preview} />
    </a>
  {/if}
</li>

<style lang="postcss">
  li {
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius-1);
    overflow: hidden;

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

    form {
      margin: 16px;
    }
  }

  .page-container {
    background: var(--color-white);
    cursor: pointer;
    display: block;
    width: 100%;
    position: relative;
    overflow: hidden;
    transition: var(--transition-colors);
    height: 20vh;

    &:hover {
      opacity: 0.5;
    }

    &.active {
      cursor: default;
      pointer-events: none;
      opacity: 0.5;

      &:after {
        opacity: 0.5;
      }
    }
  }

</style>
