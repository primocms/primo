<script>
  import axios from '$lib/libraries/axios'
  import TextField from '$lib/ui/TextField.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import config from '../../../stores/config'
  import {getSitesFromServer} from '../../../stores/serverSites'

  export let inline = false
  export let onSuccess = () => {}

  let serverErrorMessage = ''
  let loading = false

  async function connect_to_server() {
    loading = true
    $config.serverConfig.url = $config.serverConfig.url.replace(/\/+$/, '') // remove trailing slash if present
    const endpoint = `${$config.serverConfig.url}/api`
    const res = await axios.get(endpoint, {
      headers: {
        Authorization: `Basic ${$config.serverConfig.token}`,
      },
    }).catch(e => e)
    if (res?.data?.body?.success) {
      getSitesFromServer()
      serverErrorMessage = ''
      onSuccess()
    } else {
      serverErrorMessage = `Could not connect to ${$config.serverConfig.url}, ensure the address and token are correct`
      config.update((c) => ({
        ...c,
        serverConfig: {
          url: '',
          token: ''
        },
      }))
    }
    loading = false
  }

  function updateServerConfig(key, val) {
    config.update(c => ({
      ...c,
      serverConfig: {
        ...c.serverConfig,
        [key]: val
      }
    }))
  }
</script>

<div class="primo-modal" class:inline>
  <h1 class="primo-heading-lg">Connect a Primo Server</h1>
  <p>Adding a server enables you to invite collaborators, handle media, and access sites from anywhere.</p>
  <h2 class="primo-heading-lg">To add a new server:</h2>
  <ol>
    <li>Host your own Primo Server by following the instructions in the <a href="https://github.com/primodotso/primo-server">Github repo</a>. It should take less than five minutes.</li>
    <li>Copy the server token from the settings tab in the new server and paste it in the Address and API Token fields below.</li>
  </ol>
  {#if serverErrorMessage}
    <div class="error">
      {@html serverErrorMessage}
    </div>
  {/if}
  <form on:submit|preventDefault={connect_to_server}>
    <!-- <TextField
      label="Server Label"
      placeholder="Client Work"
      bind:value={serverConfig.label}
    /> -->
    <TextField
      label="Address"
      placeholder="https://myclientworkserver.com"
      value={$config.serverConfig.url}
      on:change={({target}) => updateServerConfig('url', target.value)}
    />
    <TextField
      label="Authentication Token"
      placeholder="DFYAUYHAFKUENAKJEFF982398HFNE29"
      value={$config.serverConfig.token}
      on:change={({target}) => updateServerConfig('token', target.value)}
    />
    <PrimaryButton {loading} label="Connect Server" type="submit" />
  </form>
</div>

<style lang="postcss">
  .error {
    background: #333;
    border: 1px solid red;
    padding: 1rem;
    margin: 1rem 0;
  }
  .primo-modal {
    max-width: var(--primo-max-width-1);

    &.inline {
      padding: 1rem 0;
      max-width: none;
      width: 100%;
    }

    a {
      text-decoration: underline;
    }

    p {
      padding-bottom: 1rem;
    }

    ol {
      display: grid;
      gap: 0.5rem;
      list-style: auto;
      padding-left: 1.25rem;
      padding-bottom: 2rem;
    }

    form {
      display: grid;
      gap: 0.5rem;
    }
  }
</style>