<script>
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import Spinner from '$lib/ui/Spinner.svelte'
  import TextField from '$lib/ui/TextField.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { makeValidUrl } from '$lib/utils'
  import { Site } from '$lib/editor/const'
  import Icon from '@iconify/svelte'
  import { validateSiteStructure } from '$lib/editor/utils'

  export let onSuccess = (newSite) => {}
  let loading
  let siteName = ``
  let siteID = ``
  let siteIDFocused = false
  let message = ''
  // $: siteURL = siteID
  $: canCreateSite = siteName && siteID

  let siteData

  async function createSite() {
    loading = true

    // overwrite the site id & name if it's been cloned
    // otherwise create one from scratch
    siteData = siteData
      ? {
          ...siteData,
          id: siteID,
          name: siteName,
        }
      : Site({ id: siteID, name: siteName })

    onSuccess(siteData)
  }

  function validateUrl() {
    siteID = makeValidUrl(siteIDFocused ? siteID : siteName)
  }

  let duplicatingSite = false
  let duplicateFileIsValid = true
  function readJsonFile({ target }) {
    var reader = new window.FileReader()
    reader.onload = async function ({ target }) {
      if (typeof target.result !== 'string') return

      const uploaded = JSON.parse(target.result)
      const converted = validateSiteStructure(uploaded)

      if (converted) siteData = converted
      else {
        duplicateFileIsValid = false
      }

      duplicatingSite = true
    }
    reader.readAsText(target.files[0])
  }
</script>

<main class="primo-modal">
  {#if !loading}
    <h1 class="primo-heading-xl">Create a site</h1>
    <form on:submit|preventDefault={createSite}>
      <div class="name-url">
        <TextField
          autofocus={true}
          label="Site Name"
          on:input={validateUrl}
          bind:value={siteName}
        />
        <TextField
          label="Site ID"
          bind:value={siteID}
          on:input={validateUrl}
          on:focus={() => (siteIDFocused = true)}
        />
      </div>
      {#if duplicatingSite}
        <div class="site-thumbnail">
          <SiteThumbnail bind:valid={duplicateFileIsValid} site={siteData} />
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
      <span>{duplicatingSite ? 'Duplicating' : 'Creating'} {siteName}</span>
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
