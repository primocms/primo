<script>
  import axios from 'axios'
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import ThemeThumbnail from '$lib/components/ThemeThumbnail.svelte'
  import Spinner from '$lib/ui/Spinner.svelte'
  import TextField from '$lib/ui/TextField.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { makeValidUrl } from '$lib/utils'
  import { Site } from '@primo-app/primo/src/const'
  import {validateSiteStructure} from '@primo-app/primo/src/utils'

  export let onSuccess = () => {}
  let loading
  let siteName = ``
  let siteID = ``
  let siteIDFocused = false
  let message = ''
  $: canCreateSite = siteName && siteID

  let siteData

  async function createNewSite() {
    loading = true
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

  let themes = [{},{},{}]
  axios.get('http://api.primo.af/themes.json').then(({data}) => {
    console.log({data})
    themes = data
  })

  let selectedTheme = null
  function selectTheme(theme) {
    siteData = theme.data
    selectedTheme = theme.name
  }
</script>

<main class="primo-modal">
  {#if !loading}
    <h1 class="primo-heading-lg">Create a site</h1>
    <form on:submit|preventDefault={createNewSite}>
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
        <div class="links">
          <button on:click={() => duplicatingSite = false}>back to themes</button>
          <label>
            <span>upload new site file</span>
            <input
              on:change={readJsonFile}
              type="file"
              id="primo-json"
              accept=".json"
            />
          </label>
        </div>
      {:else}
        <h2 class="primo-heading-lg">
          <span>Pick a starting point</span>
          <div class="info">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
            <span>Upload a primo JSON file or start from a Theme</span>
          </div>
        </h2>
        <div class="themes">
          <label id="upload-json">
            <input
              on:change={readJsonFile}
              type="file"
              id="primo-json"
              accept=".json"
            />
            <svg viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.29427 8.87103L6.6901 3.46061C6.86146 3.28926 7.13854 3.28926 7.3099 3.46061L12.7057 8.87103C12.8771 9.04238 12.8771 9.31946 12.7057 9.49082L11.9911 10.2054C11.8161 10.3804 11.5354 10.3768 11.3677 10.1981L7.94792 6.65801V15.7288C7.94792 15.9695 7.75104 16.1663 7.51042 16.1663H6.48958C6.24896 16.1663 6.05208 15.9695 6.05208 15.7288V6.65801L2.63594 10.1981C2.46458 10.3731 2.18385 10.3768 2.0125 10.2054L1.29792 9.49082C1.12292 9.31946 1.12292 9.04238 1.29427 8.87103ZM0.4375 1.72884H13.5625C13.8031 1.72884 14 1.53197 14 1.29134V0.270508C14 0.0298828 13.8031 -0.166992 13.5625 -0.166992H0.4375C0.196875 -0.166992 0 0.0298828 0 0.270508V1.29134C0 1.53197 0.196875 1.72884 0.4375 1.72884Z" fill="#E2E4E9"/>
            </svg>              
            <span>upload site file</span>
          </label>
          {#each themes as theme}
            <ThemeThumbnail selected={selectedTheme === theme.name} on:click={() => selectTheme(theme)} title={theme.name} site={theme.data} preview={theme.preview} />
          {/each}
        </div>
      {/if}
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
  .primo-heading-lg {
    display: flex;
  }
  .links {
    display: flex;
    margin-bottom: 1rem;

    button, label {
      transition: 0.1s border-color;
      border-bottom: 1px solid var(--color-gray-4);
      font-size: 0.75rem;
      margin-right: 1rem;
      cursor: pointer;

      input {
        display: none;
      }

      &:hover {
        border-color: transparent;
      }
    }
  }
  .themes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  #upload-json {
    display: grid;
    place-content: center;
    place-items: center;
    gap: 0.25rem;
    border-radius: var(--primo-border-radius);
    border: 2px solid var(--color-gray-8);
    cursor: pointer;

    input {
        display: none;
      }

      span {
        color: var(--color-gray-3);
        font-size: 0.75rem;
        font-weight: 500;
      }

      svg {
        height: 0.75rem;
        width: 0.75rem;
      }

    &:hover {
      box-shadow: 0px 0px 0px 3px #F27473;
    }
  }

  .info {
      position: relative;
      padding-left: 0.5rem;

      svg {
        height: 0.75rem;
        width: 0.75rem;
      }

      svg:hover + span {
        opacity: 1;
      }
      span {
        font-size: 0.75rem;
        font-weight: 500;
        line-height: 1.5;
        position: absolute;
        background: var(--color-gray-8);
        padding: 1rem;
        width: 13rem;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.1s;
        z-index: 99;
        top: 17px;
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
