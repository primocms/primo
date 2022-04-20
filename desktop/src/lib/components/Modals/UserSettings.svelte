<script>
  import axios from 'axios'
  import Tabs from '$lib/ui/Tabs.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import TextField from '$lib/ui/TextField.svelte'
  import config from '../../../stores/config'
  import {getSitesFromServer} from '../../../stores/serverSites'
  import Hosting from '../Hosting.svelte'

  export let tab = 0

  let tabs = [
    {
      label: 'Hosting',
      icon: 'globe',
    },
    {
      label: 'Server',
      icon: 'server',
    },
    {
      label: 'Advanced',
      icon: 'cog',
    },
  ]
  let activeTab = tabs[tab]

  async function selectDirectory() {
    const dir = await window.primo.config.selectDirectory()
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
    {#if activeTab.label === 'Hosting'}
      <h1 class="primo-heading-lg heading">
        Hosting <span class="supporting-text"
          >Connect to an available webhost to publish your sites to the internet</span
        >
      </h1>
      <Hosting />
    {:else if activeTab.label === 'Server'}
      <h1 class="primo-heading-lg heading">
        Primo Server <span class="supporting-text"
          >Connect to a primo server to manage your server sites from your desktop</span
        >
      </h1>
      <form on:submit|preventDefault={connectToServer}>
        <TextField
          placeholder="https://myselfhostedprimoserver.com"
          on:input={() => (connectedToServer = false)}
          bind:value={serverConfig.url}
          label="Address"
        />
        <TextField
          placeholder="IU93HUKJNT062BDS998U2JKOI"
          on:input={() => (connectedToServer = false)}
          bind:value={serverConfig.token}
          label="API Token"
        />
        <span>{serverErrorMessage}</span>
        {#if connectedToServer}
          <span>Connected to {serverConfig.url}</span>
        {:else}
          <PrimaryButton {loading} type="submit">Connect to Server</PrimaryButton>
        {/if}
      </form>
    {:else if activeTab.label === 'Advanced'}
      <h1 class="primo-heading-lg heading">Advanced</h1>
      <div class="container">
        <h2 class="heading">
          Local Save Directory
          <span class="supporting-text">Set the directory you'll be saving your sites to.</span>
        </h2>
        <span>{$config.saveDir}</span>
        <PrimaryButton on:click={selectDirectory}
          >Select directory</PrimaryButton
        >
      </div>
      <hr>
      <div class="container">
        <h2 class="heading">
          Usage Data
          <span class="supporting-text">We collect anonymous usage data (<strong>not site data</strong>) to make Primo better. <a href="https://primo.af/privacy-policy" target="blank">Learn More</a></span>
        </h2>
        <label>
          <span>Enable Anonymous Usage Data Collection</span>
          <input type="checkbox" checked={$config.telemetryEnabled} on:change={() => {
            config.update(c => ({
              ...c,
              telemetryEnabled: !$config.telemetryEnabled
            }))
          }}>
        </label>
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

    a {
      text-decoration: underline;
    }
  }
  hr {
    border-color: var(--color-gray-8);
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
</style>
