<script>
  import Icon from '@iconify/svelte'
  import { slide } from 'svelte/transition'
  import { get, set } from 'idb-keyval'
  import { createEventDispatcher, getContext } from 'svelte'
  const dispatch = createEventDispatcher()
  import modal from '$lib/editor/stores/app/modal'
  import { id as activePageID } from '$lib/editor/stores/app/activePage'
  import { url as site_url } from '$lib/editor/stores/data/site'
  import { pages as actions } from '$lib/editor/stores/actions'
  import { content_editable, validate_url } from '$lib/editor/utilities'
  import PageForm from './PageForm.svelte'

  /** @type {import('$lib').Page | null}*/
  export let parent = null

  /** @type {import('$lib').Page}*/
  export let page
  export let children = []
  export let active
  export let at_root_level = true

  let editing_page = false
  const full_url = parent
    ? `/${$site_url}/${parent.url}/${page.url}`
    : `/${$site_url}/${page.url}`

  let showing_children = true
  $: has_children = children.length > 0

  get(`${$site_url}--page-list-toggle--${page.id}`).then((toggled) => {
    if (toggled !== undefined) showing_children = toggled
  })
  $: set(`${$site_url}--page-list-toggle--${page.id}`, showing_children)

  let creating_page = false
  let new_page_url = ''
  $: new_page_url = validate_url(new_page_url)

  /**
   * @param {{ name?: string, url?: string }} args
   */
  function edit_page(args) {
    actions.update(page.id, args)
  }
</script>

<div class="page-item-container" class:active={page.id === $activePageID}>
  <div class="left">
    {#if editing_page}
      <div class="details">
        <div
          class="name"
          use:content_editable={{
            autofocus: true,
            on_change: (val) => edit_page({ name: val }),
            on_submit: () => (editing_page = false),
          }}
        >
          {page.name}
        </div>
        {#if page.url !== 'index'}
          <div class="url">
            <span>/</span>
            <div
              class="url"
              use:content_editable={{
                on_change: (val) => {
                  edit_page({ url: validate_url(val) })
                },
                on_submit: () => (editing_page = false),
              }}
            >
              {page.url}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <a
        class="details"
        class:active
        href={full_url}
        on:click={() => modal.hide()}
      >
        <span>{page.name}</span>
        <span class="url">/{page.url !== 'index' ? page.url : ''}</span>
      </a>
    {/if}
    {#if has_children}
      <button
        class="toggle"
        class:active={showing_children}
        on:click={() => (showing_children = !showing_children)}
        aria-label="Toggle child pages"
      >
        <Icon icon="mdi:chevron-down" />
      </button>
    {/if}
  </div>
  <div class="options">
    <button
      class="edit"
      class:active={editing_page}
      on:click={() => (editing_page = !editing_page)}
    >
      <Icon icon="clarity:edit-solid" />
    </button>
    {#if at_root_level}
      <button on:click={() => (creating_page = true)}>
        <Icon icon="akar-icons:plus" />
      </button>
    {/if}
    {#if page.url !== 'index'}
      <button on:click={() => dispatch('delete', page)}>
        <Icon icon="fluent:delete-20-filled" />
      </button>
    {/if}
  </div>
</div>

{#if creating_page}
  <PageForm
    {page}
    on:create={({ detail: page }) => {
      creating_page = false
      dispatch('create', page)
    }}
  />
{/if}

{#if showing_children && has_children}
  <ul class="page-list child" transition:slide|local={{ duration: 100 }}>
    {#each children as subpage}
      <li>
        <svelte:self
          parent={page}
          page={subpage}
          active={$activePageID === subpage.id}
          at_root_level={false}
          on:edit
          on:add
          on:delete
        />
      </li>
    {/each}
  </ul>
{/if}

<style lang="postcss">
  .page-item-container {
    display: flex;
    justify-content: space-between;
    padding: 0.875rem 1.125rem;
    background: #1a1a1a;

    &.active {
      background: #222;
    }

    .left {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .details {
        font-weight: 400;
        font-size: 1.125rem;
        line-height: 1.5rem;
        display: flex;
        gap: 1rem;

        .url {
          display: flex;
          font-weight: 400;
          color: var(--color-gray-5);
        }

        div.name,
        div.url {
          color: var(--primo-color-brand);

          span {
            color: var(--color-gray-5);
          }

          &:focus {
            outline: none;
          }
        }
      }

      .toggle {
        padding: 0 0.5rem;
        transition: 0.1s color;
        font-size: 1.5rem;

        &:hover {
          color: var(--color-accent);
        }

        &.active {
          transform: scaleY(-1);
        }
      }
    }

    .options {
      display: flex;
      gap: 0.5rem;

      .edit.active {
        color: var(--primo-color-brand);
      }
    }
  }

  .slot {
    background: #1c1c1c;
    margin: 0 1rem;
  }

  ul.page-list {
    margin: 0 1rem 1rem 1rem;
    background: #323334;
    border-radius: var(--primo-border-radius);

    li:not(:last-child) {
      /* border-bottom: 1px solid #222; */
    }
  }
</style>
