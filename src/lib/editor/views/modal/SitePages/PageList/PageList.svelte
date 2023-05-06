<script>
  import Item from './Item.svelte'
  import { PrimaryButton } from '$lib/editor/components/buttons'
  import pages from '$lib/editor/stores/data/pages'
  import { pages as actions } from '$lib/editor/stores/actions'
  import { id as activePageID } from '$lib/editor/stores/app/activePage'
  import PageForm from './PageForm.svelte'

  async function create_page(new_page) {
    await actions.create(new_page)
  }

  async function delete_page(page_id) {
    actions.delete(page_id)
  }

  let creating_page = false
</script>

<ul class="page-list root">
  {#each $pages.filter((p) => !p.parent) as page, i}
    {@const children = $pages.filter((p) => p.parent === page.id)}
    <li>
      <Item
        {page}
        {children}
        active={$activePageID === page.id}
        on:create={({ detail: page }) => create_page(page)}
        on:delete={({ detail: page }) => delete_page(page.id)}
      />
    </li>
  {/each}
  {#if creating_page}
    <li>
      <PageForm
        on:create={({ detail: new_page }) => {
          creating_page = false
          create_page(new_page)
        }}
      />
    </li>
  {/if}
</ul>
{#if !creating_page}
  <PrimaryButton
    on:click={() => (creating_page = true)}
    label="Create Page"
    icon="akar-icons:plus"
  />
{/if}

<style lang="postcss">
  ul.page-list {
    display: grid;
    color: var(--primo-color-white);
    background: #1a1a1a;
    border-radius: var(--primo-border-radius);
    margin-bottom: 1rem;

    &.root > li:not(:first-child) {
      border-top: 1px solid #222;
    }
  }
  #duplicate label {
    display: flex;
    gap: 0.5rem;
    margin: 0.25rem 0;
  }
  form {
    padding: 0.25rem;
    display: grid;
    gap: 0.5rem;
    max-width: 450px;
    padding: 0.825rem 1.125rem;
    margin-bottom: 0.5rem;
  }
</style>
