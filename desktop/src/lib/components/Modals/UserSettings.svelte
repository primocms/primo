<script>
  import axios from '$lib/libraries/axios'
  import Tabs from '$lib/ui/Tabs.svelte'
  import { _ as C } from 'svelte-i18n';
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import TextField from '$lib/ui/TextField.svelte'
  import config from '../../../stores/config'
  import {getSitesFromServer} from '../../../stores/serverSites'
  import Hosting from '../Hosting.svelte'
  import {setLanguage} from '$lib/actions'

  let tabs = []
  $: tabs = [
    {
      id: 'HOSTING',
      label: $C('settings.hosting.heading'),
      icon: 'globe',
    },
    {
      id: 'ADVANCED',
      label: $C('settings.advanced.heading'),
      icon: 'cog',
    },
  ]
  let activeTab = { id: 'HOSTING' }

  async function selectDirectory() {
    const dir = await window.primo?.config.selectDirectory()
    if (dir) {
      $config = {
        ...$config,
        saveDir: dir,
      }
      window.location.reload()
    }
  }

  const serverConfig = $config.serverConfig
  let connectedToServer = false
  let serverErrorMessage = ''
  let loading = false
  async function connectToServer() {
    loading = true
    const url = serverConfig.url.replace(/\/$/, "") // remove trailing slash if present
    const endpoint = `${url}/api.json`
    let data
    try {
      const res = await axios.get(endpoint, {
        headers: {
          Authorization: `Basic ${serverConfig.token}`,
        },
      })
      data = res.data.success
    } catch (e) {
      console.error(e)
      data = null
    }
    if (data) {
      config.update((c) => ({
        ...c,
        serverConfig,
      }))
      getSitesFromServer()
      connectedToServer = true
      serverErrorMessage = ''
    } else {
      config.update((c) => ({
        ...c,
        serverConfig: {
          url: '',
          token: ''
        },
      }))
      connectedToServer = false
      if (serverConfig.url) {
        serverErrorMessage = `Could not connect to ${serverConfig.url}. Ensure the address and token are correct & try again.`
      }
    }
    loading = false
  }
  connectToServer()

</script>

<main>
  <Tabs {tabs} bind:activeTab />
  <div class="content-container">
    {#if activeTab.id === 'HOSTING'}
      <h1 class="primo-heading-lg heading">
        {$C('settings.hosting.heading')} <span class="supporting-text"
          >{$C('settings.hosting.subheading')}</span
        >
      </h1>
      <Hosting />
    {:else if activeTab.id === 'ADVANCED'}
      <h1 class="primo-heading-lg heading">{$C('settings.advanced.heading')}</h1>
      <div class="container">
        <h2 class="heading">
          {$C('settings.advanced.save.heading')}
          <span class="supporting-text">{$C('settings.advanced.save.subheading')}</span>
        </h2>
        <span>{$config.saveDir}</span>
        <PrimaryButton on:click={selectDirectory}
          >{$C('settings.advanced.save.button')}</PrimaryButton
        >
      </div>
      <div class="container">
        <h2 class="heading">
          <span>{$C('settings.advanced.lang.heading')}</span>
          <span class="supporting-text">{$C('settings.advanced.lang.subheading')}</span>
        </h2>
        <select value={$config.language} on:change={({target}) => {
          const lang = target.value
          setLanguage(lang)
        }}>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
    {/if}
  </div>
</main>

<style lang="postcss">
  .heading {
    display: flex;
    flex-direction: column;
    line-height: 1.4;
    margin-bottom: 1rem;
  }
  span.supporting-text {
    font-weight: 500;
    font-size: 0.75rem;
    color: var(--color-gray-4);
  }
  .container {
    padding: 1rem 0;

    &:last-child {
      padding-bottom: 0;
    }
  }
  main {
    color: var(--color-gray-1);
    background: var(--color-gray-9);
    padding: 2rem;
    border: 2px solid var(--color-primored);
    border-radius: 0.25rem;
    width: 100vw;
    max-width: 600px;

    .content-container {
      margin-top: 1rem;
    }

    & > * {
      margin: 0.5rem 0;
    }

    --space-y: 1rem;
  }
  select {
    width: 100%;
    background: var(--color-gray-9);
    color: var(--color-gray-2);
    font-size: var(--font-size-2);
    font-weight: 600;
    border: 1px solid var(--color-gray-8);
    border-radius: var(--primo-border-radius);
    padding: 0.5rem !important;
  }
</style>
