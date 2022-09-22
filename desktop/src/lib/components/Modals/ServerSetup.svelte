<script>
  import axios from '$lib/libraries/axios'
  import TextField from '$lib/ui/TextField.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import config from '../../../stores/config'
  import {getSitesFromServer} from '../../../stores/serverSites'

  export let onSuccess = (data) => {}

  const serverConfig = $config.serverConfig
  let connectedToServer = false
  let serverErrorMessage = ''
  let loading = false

  async function connect_to_server() {
    loading = true
    const url = serverConfig.url.replace(/\/$/, "") // remove trailing slash if present
    const endpoint = `${serverConfig.url}/api`
    const res = await axios.get(endpoint, {
      headers: {
        Authorization: `Basic ${serverConfig.token}`,
      },
    }).catch(e => e)
    if (res.status === 200) {
      config.update((c) => ({
        ...c,
        serverConfig,
      }))
      getSitesFromServer()
      connectedToServer = true
      serverErrorMessage = ''
      onSuccess()
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
  if (serverConfig.url) connect_to_server()
</script>

<div class="primo-modal">
  <h1 class="primo-heading-lg">Connect a Primo Server</h1>
  <p>Adding a server enables you to invite collaborators, handle media, and access sites from anywhere.</p>
  <h2 class="primo-heading-lg">To add a new server:</h2>
  <ol>
    <li>Host your own Primo Server by following the instructions in the <a href="https://github.com/primodotso/primo-server">Github repo</a>. It should take less than five minutes.</li>
    <li>Copy the server token from the settings tab in the new server and paste it in the Address and API Token fields below.</li>
  </ol>
  <form on:submit|preventDefault={connect_to_server}>
    <TextField
      label="Server Label"
      placeholder="Client Work"
      bind:value={serverConfig.label}
    />
    <TextField
      label="Address"
      placeholder="https://myclientworkserver.com"
      bind:value={serverConfig.url}
    />
    <TextField
      label="Authentication Token"
      placeholder="DFYAUYHAFKUENAKJEFF982398HFNE29"
      bind:value={serverConfig.token}
    />
    <PrimaryButton {loading} label="Connect Server" type="submit" />
  </form>
</div>

<style lang="postcss">
  .primo-modal {
    max-width: var(--primo-max-width-1);

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