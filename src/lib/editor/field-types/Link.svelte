<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  import SplitButton from '../ui/inputs/SplitButton.svelte'
  import TextInput from '../components/inputs/TextInput.svelte'
  import pages from '../stores/data/pages'
  import { locale } from '../stores/app/misc'

  const link = {
    label: '',
    url: '',
    active: false,
  }

  export let field = {
    value: link,
  }

  if (!field.value || !field.value.label) {
    field.value = link
  }

  $: if (typeof field.value === 'string' || !field.value) {
    field.value = {
      label: '',
      url: '',
      active: false,
    }
  } else if (field.value.title && !field.value.label) {
    // Fix old values using `title` instead of `label`
    field.value = {
      ...field.value,
      label: field.value.title,
    }
  }

  let selected = urlMatchesPage(field.value.url)

  function urlMatchesPage(url) {
    if (url && url.startsWith('/')) {
      return 'Page'
    } else {
      return 'URL'
    }
  }

  function getPageUrl(page, loc) {
    const prefix = loc === 'en' ? '/' : `/${loc}/`
    if (page.url === 'index') {
      return prefix
    } else {
      return prefix + page.url
    }
  }
</script>

<div class="primo-link">
  <span>{field.label}</span>
  <div class="inputs">
    <TextInput
      on:input={() => dispatch('input', field)}
      bind:value={field.value.label}
      id="page-label"
      label="Label"
      placeholder="About Us"
    />
    <div class="url-select">
      <SplitButton
        bind:selected
        buttons={[
          { id: 'Page', icon: 'fa-solid:clone' },
          { id: 'URL', icon: 'akar-icons:link-chain' },
        ]}
      />
      {#if selected === 'Page'}
        <select
          bind:value={field.value.url}
          on:change={() => dispatch('input')}
        >
          {#each $pages as page}
            <option value={getPageUrl(page, $locale)}>
              {page.name}
              <pre>({getPageUrl(page, $locale)})</pre>
            </option>
            <!-- TODO: Fix this -->
            <!-- {#if page.pages.length > 0}
              <optgroup label={page.name}>
                {#each page.pages as childpage}
                  <option value={getPageUrl(childpage, $locale)}>
                    {childpage.name}
                    <pre>({getPageUrl(childpage, $locale)})</pre>
                  </option>
                {/each}
              </optgroup>
            {/if} -->
          {/each}
        </select>
      {:else}
        <TextInput
          on:input={() => dispatch('input', field)}
          bind:value={field.value.url}
          type="url"
          placeholder="https://primocms.org"
        />
      {/if}
    </div>
  </div>
</div>
<slot />

<style lang="postcss">
  .primo-link {
    display: flex;
    flex-direction: column;

    span {
      font-size: var(--title-font-size, 1rem);
      font-weight: var(--title-font-weight, 700);
      padding-bottom: 1rem;
      letter-spacing: 1px;
    }

    .inputs {
      display: grid;
      gap: 1rem;
      width: 100%;
      --TextInput-mt: 0.25rem;
      --TextInput-label-font-size: 0.75rem;
      --SplitButton-mb: 0.25rem;

      .url-select {
        display: grid;
        gap: 1rem;
        place-items: flex-start;

        select {
          width: 100%;
          background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
          background-position: calc(100% - 0.25rem);
          background-repeat: no-repeat;
          appearance: none;
          padding: 0.5rem 0.75rem;
          padding-right: 0;
          border: 0;
          background-color: var(--input-background);
          border: var(--input-border);
          border-radius: var(--input-border-radius);
          margin-top: 0.25rem;

          &:focus {
            outline: none;
          }
        }
      }
    }
  }
</style>
