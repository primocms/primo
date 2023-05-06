<script>
  import { createEventDispatcher } from 'svelte'
  import { v4 as uuidv4 } from 'uuid'
  import { fade } from 'svelte/transition'
  import { TextInput } from '$lib/editor/components/inputs'
  import Select from '$lib/editor/ui/inputs/Select.svelte'
  import pages from '$lib/editor/stores/data/pages'
  import Icon from '@iconify/svelte'
  import { validate_url } from '$lib/editor/utilities'
  import { id as active_page_id } from '$lib/editor/stores/app/activePage'
  import { Page } from '$lib/editor/const'

  /** @type {import('$lib').Page | null} */
  export let page = null

  const dispatch = createEventDispatcher()

  let new_page_name = ''
  let new_page_url = ''
  let new_page_source = $active_page_id
  $: page_creation_disabled = !new_page_name || !new_page_url

  let page_label_edited = false
  $: new_page_url = page_label_edited
    ? validate_url(new_page_url)
    : validate_url(new_page_name)

  $: new_page = Page({
    ...$pages.find((p) => p.id === new_page_source),
    id: uuidv4(),
    name: new_page_name,
    url: new_page_url,
    parent: page?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
</script>

<form
  on:submit|preventDefault={() => dispatch('create', new_page)}
  in:fade={{ duration: 100 }}
>
  <TextInput
    autofocus={true}
    bind:value={new_page_name}
    id="page-label"
    label="Page Name"
    placeholder="About Us"
  />
  <TextInput
    bind:value={new_page_url}
    id="page-url"
    label="Page URL"
    on:input={() => (page_label_edited = true)}
    placeholder="about-us"
  />
  <div class="select">
    <Select
      label="Create from"
      bind:value={new_page_source}
      options={[
        { id: 'blank', label: 'Blank' },
        { id: 'DIVIDER' },
        ...$pages.map((p) => ({ id: p.id, label: p.name })),
      ]}
    />
  </div>
  <button disabled={page_creation_disabled}>
    <Icon icon="akar-icons:check" />
  </button>
</form>

<style lang="postcss">
  form {
    padding: 0.25rem;
    display: flex;
    gap: 0.5rem;
    padding: 0.825rem 1.125rem;
    place-items: center;

    --TextInput-label-font-size: 0.75rem;

    .select {
      max-width: 6rem;
    }

    button {
      border: 1px solid var(--primo-color-brand);
      border-radius: 0.25rem;
      padding: 9px 0.75rem;
      margin-top: 23px;
      margin-left: 0.25rem;

      &:disabled {
        opacity: 20%;
      }
    }
  }
</style>
