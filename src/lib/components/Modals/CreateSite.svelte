<script>
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import Spinner from '$lib/ui/Spinner.svelte'
  import TextField from '$lib/ui/TextField.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { makeValidUrl } from '$lib/utils'
  import { Site } from '$lib/editor/const'
  import Icon from '@iconify/svelte'
  import { validate_site_structure_v2 } from '$lib/converter'
  import { buildStaticPage } from '$lib/editor/stores/helpers'

  export let onSuccess = (newSite) => {}
  let loading
  let site_name = ``
  let site_url = ``
  let siteIDFocused = false
  let message = ''
  // $: siteURL = site_url
  $: canCreateSite = site_name && site_url

  let siteData
  let preview

  async function createSite() {
    loading = true

    // overwrite the site id & name if it's been cloned
    // otherwise create one from scratch
    siteData = siteData
      ? {
          ...siteData,
          url: site_url,
          name: site_name,
        }
      : Site({ url: site_url, name: site_name })

    // TODO: populate blank site

    onSuccess({
      data: siteData,
      preview,
    })
  }

  function validateUrl() {
    site_url = makeValidUrl(siteIDFocused ? site_url : site_name)
  }

  let duplicatingSite = false
  let duplicateFileIsValid = true
  function readJsonFile({ target }) {
    var reader = new window.FileReader()
    reader.onload = async function ({ target }) {
      if (typeof target.result !== 'string') return

      const uploaded = JSON.parse(target.result)
      const converted = validate_site_structure_v2(uploaded)
      if (converted) {
        siteData = converted
        preview = await buildStaticPage({
          page: siteData.pages[0],
          site: siteData,
          page_sections: siteData.sections.filter(
            (section) => section.page === siteData.pages[0].id
          ),
          page_symbols: siteData.symbols,
        })
      } else {
        duplicateFileIsValid = false
      }

      duplicatingSite = true
    }
    reader.readAsText(target.files[0])
  }
</script>

<main class="primo-reset primo-modal">
  {#if !loading}
    <h1 class="primo-heading-xl">Create a site</h1>
    <form on:submit|preventDefault={createSite}>
      <div class="name-url">
        <TextField
          autofocus={true}
          label="Site Name"
          on:input={validateUrl}
          bind:value={site_name}
        />
        <TextField
          label="Site URL"
          bind:value={site_url}
          on:input={validateUrl}
          on:focus={() => (siteIDFocused = true)}
        />
      </div>
      {#if duplicatingSite}
        <div class="site-thumbnail">
          <SiteThumbnail {preview} />
        </div>
      {/if}
      <footer>
        <div id="upload-json">
          <label class="container">
            <input
              on:change={readJsonFile}
              type="file"
              id="primo-json"
              accept=".json"
            />
            <Icon icon="carbon:upload" />
            <span>Duplicate from primo.json</span>
          </label>
        </div>
        <a class="container" href="https://primo.so/marketplace" target="blank">
          <Icon icon="gridicons:themes" />
          <span>Primo Themes</span>
        </a>
      </footer>
      <div class="submit">
        <PrimaryButton
          type="submit"
          label={duplicatingSite ? 'Duplicate' : 'Create'}
          disabled={!canCreateSite && duplicateFileIsValid}
        />
      </div>
    </form>
  {:else}
    <div class="creating-site">
      <span>{duplicatingSite ? 'Duplicating' : 'Creating'} {site_name}</span>
      {#key message}
        <p>{message}</p>
      {/key}
      <Spinner />
    </div>
  {/if}
</main>

<style lang="postcss">
  .primo-modal {
    max-width: var(--primo-max-width-1);

    form {
      .name-url {
        margin-bottom: 1.5rem;
      }

      .submit {
        --color-link: var(--color-primored);
      }
    }
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .container {
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    span {
      color: var(--color-gray-3);
      font-size: 0.75rem;
      text-decoration: underline;
    }
  }
  #upload-json {
    margin-bottom: 0.5rem;
    display: flex;
    justify-content: flex-start;

    label {
      cursor: pointer;

      input {
        display: none;
      }

      span {
        color: var(--color-gray-3);
        font-size: 0.75rem;
        text-decoration: underline;
      }
    }
  }

  .site-thumbnail {
    margin: 1rem 0;
    border-radius: 0.25rem;
    overflow: hidden;
    border: 1px solid var(--color-gray-8);
  }

  .creating-site {
    display: flex;
    align-items: center;

    & > * {
      margin: 0 1rem;
    }
  }
</style>
