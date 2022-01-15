<script>
  import { onMount } from 'svelte'
  import { createUniqueID } from '@primo-app/primo/src/utilities'
  import Tabs from '$lib/ui/Tabs.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import CopyButton from '$lib/ui/CopyButton.svelte'
  import Hosting from '../Hosting.svelte'
  import * as supabaseDB from '../../../supabase/db'

  const tabs = [
    {
      label: 'Hosting',
      icon: 'globe',
    },
    {
      label: 'Server',
      icon: 'server',
    },
  ]
  let activeTab = tabs[0]

  let token = null
  async function createToken() {
    const tokenToSet = createUniqueID(25).toUpperCase()
    const success = await supabaseDB.config.update('server-token', tokenToSet)
    if (success) {
      token = tokenToSet
    }
  }

  onMount(async () => {
    token = await supabaseDB.config.get('server-token')
  })
</script>

<main>
  <Tabs {tabs} bind:activeTab />
  <div class="content-container">
    {#if activeTab.label === 'Hosting'}
      <h1 class="primo-heading-lg">
        Hosting <span
          >Connect to your favorite webhost to publish your primo sites to the
          internet</span
        >
      </h1>
      <Hosting showDetails={false} />
    {:else if activeTab.label === 'Server'}
      <h1 class="primo-heading-lg">
        Primo Server
        {#if token}
          <span
            >Paste your token into Primo Desktop to manage your sites from
            there. Note that creating a new token will invalidate the current
            one.</span
          >
        {:else}
          <span>Create a token to manage your sites from your desktop</span>
        {/if}
      </h1>
      <div>
        {#if token}
          <CopyButton label={token} />
          <button on:click={createToken}>Create New Token</button>
          <!-- <PrimaryButton on:click={createToken}></PrimaryButton> -->
        {:else}
          <PrimaryButton on:click={createToken}>Create Token</PrimaryButton>
        {/if}
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
  button {
    font-size: 0.75rem;
    margin: 1rem 0;
    text-decoration: underline;
    color: var(--color-gray-4);
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

    hr {
      border-color: var(--color-gray-8);
      margin: 1.5rem 0;
    }

    --space-y: 1rem;
  }
</style>
