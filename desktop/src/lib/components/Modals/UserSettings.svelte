<script>
  import axios from 'axios'
  import Tabs from '$lib/ui/Tabs.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import TextField from '$lib/ui/TextField.svelte'
  import config from '../../../stores/config'
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
    const endpoint = `${serverConfig.url}/api.json`
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
      connectedToServer = true
      serverErrorMessage = ''
    } else {
      connectedToServer = false
      serverErrorMessage = `Could not connect to ${serverConfig.url}. Ensure the address and token are correct & try again.`
    }
    loading = false
  }
  connectToServer()
</script>

<main>
  <Tabs {tabs} bind:activeTab />
  <div class="content-container">
    {#if activeTab.label === 'Hosting'}
      <h1 class="primo-heading-lg">
        Hosting <span
          >Connect to an available webhost to publish your sites to the internet</span
        >
      </h1>
      <Hosting />
    {:else if activeTab.label === 'Server'}
      <h1 class="primo-heading-lg">
        Primo Server <span
          >Connect to a primo server to manage your sites from your desktop</span
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
        <PrimaryButton {loading} type="submit" disabled={connectedToServer}
          >{connectedToServer
            ? 'Successfully Connected'
            : 'Connect to Server'}</PrimaryButton
        >
      </form>
    {:else if activeTab.label === 'Advanced'}
      <h1 class="primo-heading-lg">
        Advanced <span>Set the directory you'll be saving your sites to.</span>
      </h1>
      <div>
        <h2>Local Save Directory</h2>
        <span>{$config.saveDir}</span>
        <PrimaryButton on:click={selectDirectory}
          >Select directory</PrimaryButton
        >
      </div>
    {/if}
  </div>
</main>

<style lang="postcss">
  h1 {
    display: flex;
    flex-direction: column;
    line-height: 1.4;
    margin-bottom: 1rem;

    span {
      font-weight: 500;
      font-size: 0.75rem;
      color: var(--color-gray-4);
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
