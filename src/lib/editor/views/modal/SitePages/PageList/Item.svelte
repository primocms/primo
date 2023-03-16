<script>
  import Icon from '@iconify/svelte'
  import { get, set } from 'idb-keyval'
  import { fade, slide } from 'svelte/transition'
  import { createEventDispatcher, getContext } from 'svelte'
  const dispatch = createEventDispatcher()
  import { TextInput } from '../../../../components/inputs'
  import { PrimaryButton } from '../../../../components/buttons'
  import modal from '../../../../stores/app/modal'
  import { id as activePageID } from '../../../../stores/app/activePage'

  const siteID = window.location.pathname.split('/')[1]

  export let page
  export let children = []
  export let active
  export let is_parent = true

  // workaround for sveltekit bug: https://github.com/sveltejs/kit/issues/6496
  function open_page(url) {
    modal.hide()
    goto(url)
  }

  let editing_page = false
  let name = page.name || ''
  let id = page.id || ''
  $: disableSave = !name || !id

  const pageURL = `/${siteID}/${page.url === 'index' ? '' : page.url || ''}`

  let showing_children = true
  // $: has_children = page.pages.length > 0
  $: has_children = children.length > 0

  get(`${siteID}--page-list-toggle--${page.id}`).then((toggled) => {
    if (toggled !== undefined) showing_children = toggled
  })
  $: set(`${siteID}--page-list-toggle--${page.id}`, showing_children)

  // strip parent page from id
  function get_simple_page_url(id) {
    if (id === 'index') return id
    const i = id.indexOf('/') + 1
    return i ? id.slice(i, id.length) : id
  }
</script>

{#if editing_page}
  <form
    on:submit|preventDefault={() => {
      editing_page = false
      dispatch('edit', { name, id })
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
    {#if id !== 'index'}
      <TextInput
        bind:value={id}
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
{:else}
  <div class="page-item-container">
    <div class="left">
      <a class="name" class:active href={pageURL} on:click={() => modal.hide()}>
        <span>{page.name}</span>
        <span>/{get_simple_page_url(page.url)}</span>
      </a>
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
      <button on:click={() => (editing_page = true)}>
        <Icon icon="clarity:edit-solid" />
      </button>
      {#if is_parent}
        <button on:click={() => dispatch('add', page)}>
          <Icon icon="akar-icons:plus" />
        </button>
      {/if}
      {#if page.id !== 'index'}
        <button on:click={() => dispatch('delete', page)}>
          <Icon icon="fluent:delete-20-filled" />
        </button>
      {/if}
    </div>
  </div>
{/if}

<div class="slot">
  <slot />
</div>

{#if showing_children && has_children}
  <ul class="page-list child">
    {#each children as subpage}
      <li>
        <svelte:self
          page={subpage}
          active={$activePageID === subpage.id}
          is_parent={false}
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

    .left {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .name {
        font-weight: 700;
        font-size: 1.125rem;
        line-height: 1.5rem;
        display: flex;
        gap: 1rem;

        span:last-child {
          font-weight: 500;
          color: var(--color-gray-5);
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
    }
  }

  form {
    padding: 0.25rem;
    display: grid;
    gap: 0.25rem;
    max-width: 400px;
    padding: 0.825rem 1.125rem;
  }

  .slot {
    background: #323334;
    margin: 0 1rem;
  }

  ul.page-list {
    margin: 0 1rem 1rem 1rem;
    background: #323334;
    border-radius: var(--primo-border-radius);

    li:not(:last-child) {
      border-bottom: 1px solid #4b4d4e;
    }
  }
</style>
