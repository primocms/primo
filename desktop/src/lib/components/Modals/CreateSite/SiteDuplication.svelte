<script>
  import {createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  import _ from 'lodash'
  import Icon from '@iconify/svelte'
  import axios from '$lib/libraries/axios'
  import { _ as C } from 'svelte-i18n'
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import TextInput from '$lib/ui/TextField.svelte'
  import {buildStaticPage} from '@primo-app/primo/stores/helpers'
  import {validateSiteStructure} from '@primo-app/primo/utils'
  import Button from '@primo-app/primo/components/buttons/Button.svelte'

  const dispatch = createEventDispatcher()

  let site_url = ''

  let duplicatingSite = false
  let duplicateFileIsValid = true
  let duplicationPreview
  function readJsonFile({ target }) {
    var reader = new window.FileReader()
    duplicatingSite = true

    reader.onload = async function ({ target }) {
      if (typeof target.result !== 'string') return
      const uploaded = JSON.parse(target.result)
      set_site(uploaded)
    }
    reader.readAsText(target.files[0])
  }

  async function download_site_file() {
    duplicatingSite = true
    const {data} = await axios.get(`${site_url}/primo.json`)
    set_site(data)
  }

  async function set_site(data) {
    const converted = validateSiteStructure(data)
    if (converted) {
      duplicationPreview = await buildStaticPage({
        site: converted,
        page: _.find(converted.pages, ['id', 'index'])
      })
      dispatch('submit', converted)
    }
    else {
      duplicateFileIsValid = false
    }
  }

  function reset() {
    duplicatingSite = false
    duplicateFileIsValid = true
  }

</script>

<div in:fade>
  <header>
    <button class="primo--link" on:click={() => dispatch('back')}>
      <Icon icon="material-symbols:arrow-back-rounded" />
      <span>Go back</span>
    </button>
  </header>
  <h1 class="primo-heading-lg">{$C('dashboard.create.duplicate.heading')}</h1>
  {#if duplicatingSite && duplicateFileIsValid}
    <div class="site-thumbnail">
      <SiteThumbnail preview={duplicationPreview} />
    </div>
    <Button on:click={() => dispatch('create')}>Create Site</Button>
  {:else}
    {#if duplicateFileIsValid}
      <div class="content-container">
        Duplicate any existing Primo site by entering the URL of a Primo site with a published site file or uploading a Primo site file.
      </div>
      <div class="links">
        <form on:submit|preventDefault={download_site_file}>
          <TextInput label="Site URL" bind:value={site_url} button={{ label: 'Download', type: 'submit' }}/>
        </form>
        <span class="separator">or</span>
        <Button element="label">
          <span>{$C('dashboard.create.upload')}</span>
          <input
            on:change={readJsonFile}
            type="file"
            id="primo-json"
            accept=".json"
          />
        </Button>
      </div>
    {:else}
      <div>File is invalid</div>
      <button class="link" on:click={reset}>Try again</button>
    {/if}
  {/if}
</div>

<style lang="postcss">
  .content-container {
    padding-block: 1rem;
    font-size: 0.875rem;
    color: var(--color-gray-2);
  }
  .site-thumbnail {
    margin: 1rem 0;
    border-radius: 0.25rem;
    overflow: hidden;
    border: 1px solid var(--color-gray-8);
  }
  .links {
    display: grid;

    .separator {
      margin-bottom: 1rem;
      font-style: italic;
      font-size: 0.75rem;
      text-align: center;
    }

    input {
      display: none;
    }

    label {
      cursor: pointer;

      &:hover {
        border-color: transparent;
      }
    }
  }
  .primo--link {
    font-size: 0.75rem;
    border-bottom: 1px solid;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
  }
</style>