<script context="module">
  const compilations = new Map()
</script>

<script>
  import { fade } from 'svelte/transition'
  import { createEventDispatcher, getContext } from 'svelte'
  const dispatch = createEventDispatcher()
  import { TextInput } from '../../../../components/inputs'
  import { PrimaryButton } from '../../../../components/buttons'
  import Preview from '../../../../components/misc/Preview.svelte'

  import modal from '../../../../stores/app/modal'
  import { buildStaticPage } from '../../../../stores/helpers'
  import { site } from '../../../../stores/data/draft'

  const isTryPrimo = getContext('ENVIRONMENT') === 'TRY'

  export let page
  export let active = false
  export let disableAdd = false
  export let displayOnly = false

  let preview = page.preview
  // $: if (page) build_preview()
  // async function build_preview() {
  //   if (compilations.has(page)) {
  //     preview = compilations.get(page)
  //   } else {
  //     preview = await buildStaticPage({ page, site: $site })
  //     compilations.set(page, preview)
  //   }
  // }

  // workaround for sveltekit bug: https://github.com/sveltejs/kit/issues/6496
  function open_page(url) {
    modal.hide()
    goto(url)
  }

  let editing_page = false
  let name = page.name || ''
  let url = page.url || ''
  $: disableSave = !name || !url

  const siteID = window.location.pathname.split('/')[1]

  const pageURL = isTryPrimo
    ? `/${page.url === 'index' ? '' : page.url || ''}`
    : `/${siteID}/${page.url === 'index' ? '' : page.url || ''}`

  // strip parent page from url
  function get_simple_page_id(url) {
    if (url === 'index') return url
    const i = url.indexOf('/') + 1
    return i ? url.slice(i, url.length) : url
  }
</script>

<div class="page-item">
  <div class="page-info">
    <a href={pageURL} on:click={() => modal.hide()}>
      <span class="title">{page.name}</span>
      <span class="subtitle">{get_simple_page_id(page.url)}</span>
    </a>
    {#if !displayOnly}
      <div class="primo-buttons">
        <button title="Edit" on:click={() => (editing_page = !editing_page)}>
          <i class="fas fa-edit" />
        </button>
        {#if page.pages && page.pages.length > 0 && !disableAdd}
          <button title="Show child pages" on:click={() => dispatch('list')}>
            <i class="fas fa-th-large" />
          </button>
        {:else if page.url !== 'index' && !disableAdd}
          <button title="Add child page" on:click={() => dispatch('add')}>
            <i class="fas fa-plus" />
          </button>
        {/if}
        {#if page.url !== 'index'}
          <button
            title="Delete page"
            on:click={() => dispatch('delete')}
            class="delete"
          >
            <i class="fas fa-trash" />
          </button>
        {/if}
      </div>
    {/if}
  </div>
  <div class="page-body" class:editing={editing_page}>
    {#if editing_page}
      <form
        on:submit|preventDefault={() => {
          editing_page = false
          dispatch('edit', { name, url })
        }}
        in:fade={{ duration: 100 }}
      >
        <TextInput
          bind:value={name}
          id="page-label"
          autofocus={true}
          label="Page Label"
          placeholder="About Us"
        />
        {#if url !== 'index'}
          <TextInput
            bind:value={url}
            id="page-url"
            label="Page URL"
            prefix="/"
            placeholder="about-us"
          />
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
        class="page-link"
        href={pageURL}
        class:active
        on:click={() => modal.hide()}
      >
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
    border-radius: var(--primo-border-radius);
    overflow: hidden;
    position: relative;

    .page-info {
      color: var(--color-gray-2);
      background: var(--primo-color-codeblack);
      width: 100%;
      display: grid;
      grid-template-columns: auto auto;
      gap: 0.25rem;
      padding: 8px 12px;

      a {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

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

      .primo-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.25rem;

        button {
          padding: 4px;
          font-size: var(--font-size-1);
          transition: var(--transition-colors);

          &:hover {
            color: var(--primo-color-brand);
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
      border-top: 1px solid var(--color-gray-9);
      height: 0;
      padding-top: calc(75% - 37px);
      /* include header in square */
      position: relative;

      &.editing {
        overflow: scroll; /* prevent fields from being hidden */
      }

      .page-link {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: var(--primo-color-white);
        display: block;
        width: 100%;
        overflow: hidden;
        transition: var(--transition-colors);
        min-height: 10rem;

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
      .page-link {
        &:hover {
          opacity: 0.5;
        }
      }
    }

    form {
      background: var(--primo-color-codeblack);
      padding: 1rem;
      position: absolute;
      inset: 0;
      bottom: initial;

      --TextInput-label-font-size: 0.75rem;
      --TextInput-mb: 0.75rem;
    }
  }
</style>
