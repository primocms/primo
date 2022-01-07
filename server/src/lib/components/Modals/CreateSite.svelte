<script>
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import Spinner from '$lib/ui/Spinner.svelte'
  import TextField from '$lib/ui/TextField.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { makeValidUrl } from '$lib/utils'
  import { Site } from '@primo-app/primo/src/const'

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
    console.log('reading')
    var reader = new window.FileReader()
    reader.onload = async function ({ target }) {
      console.log('loaded')
      if (typeof target.result !== 'string') return
      siteData = JSON.parse(target.result)
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
      <div id="upload-json">
        <label>
          <input
            on:change={readJsonFile}
            type="file"
            id="primo-json"
            accept=".json"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
              clip-rule="evenodd"
            />
          </svg>
          <span>Duplicate from primo.json</span>
        </label>
      </div>
      {#if duplicateFileIsValid}
        <div class="submit">
          <PrimaryButton
            type="submit"
            label={duplicatingSite ? 'Duplicate' : 'Create'}
            disabled={!canCreateSite}
          />
        </div>
      {/if}
    </form>
  {:else}
    <div class="creating-site">
      <span>{duplicatingSite ? 'Creating' : 'Duplicating'} {siteName}</span>
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

    details {
      margin-bottom: 1.5rem;

      summary {
        margin-bottom: 0.5rem;
        &:focus {
          outline: 0;
          cursor: pointer;
          font-size: var(--font-size-2);
        }
      }
    }
  }
  #upload-json {
    margin-bottom: 0.5rem;
    display: flex;
    justify-content: flex-start;

    label {
      cursor: pointer;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;

      input {
        display: none;
      }

      span {
        color: var(--color-gray-3);
        font-size: 0.75rem;
        text-decoration: underline;
      }

      svg {
        height: 0.75rem;
        width: 0.75rem;
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
