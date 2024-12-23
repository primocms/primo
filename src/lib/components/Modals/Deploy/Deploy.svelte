<script>
  import Icon from '@iconify/svelte'
  import _ from 'lodash-es'
  import UI from '$lib/builder/ui'
  import ModalHeader from '$lib/components/ModalHeader.svelte'
  import { page } from '$app/stores'
  import axios from 'axios'
  import { sites as site_actions } from '../../../../actions'

  let { stage = $bindable() } = $props()

  async function publish_site() {
    // const res = await site_actions.deploy($page.data.site.id, $page.data.site.custom_domain)
    // console.log({ res })
    loading = true
    const { data } = await axios.post('/api/deploy/publish-changes', {
      site_id: $page.data.site.id,
    })
    console.log({ data })
    loading = false
    stage = 'PUBLISHED'
  }

  if ($page.data.site.custom_domain_connected) {
    stage = 'DOMAIN_CONNECTED'
  } else if ($page.data.site.nameservers) {
    stage = 'CONNECTING_DOMAIN'
  } else if (!stage) {
    stage = 'INITIAL'
  }

  let domain_name = $state($page.data.site.custom_domain)
  let nameservers = $state($page.data.site.nameservers)
  async function setup_domain_name() {
    // loading = 'CONNECTING'
    // await deploy({ domain_name, site_id: $page.data.site.id }, 'CONNECT_DOMAIN_NAME')

    const { data } = await axios.post('/api/deploy/setup-domain-name', {
      domain_name,
      site_id: $page.data.site.id,
    })
    if (data.success) {
      stage = 'CONNECTING_DOMAIN'
      nameservers = data.nameservers
    }
    loading = false
  }

  async function connect_domain_name() {
    const { data } = await axios.post('/api/deploy/connect-domain-name', {
      domain_name,
      site_id: $page.data.site.id,
    })
    if (data.success) {
      stage = 'DOMAIN_CONNECTED'
    }
  }

  let loading = $state(false)
</script>

<ModalHeader title="Publish" icon="entypo:publish" />
<div class="Deploy primo-reset">
  {#if stage === 'INITIAL'}
    <div class="container">
      <p class="description">
        Your website is live at <a
          href="https://{$page.data.site.id}.primo.page"
          target="blank"
        >
          {$page.data.site.id}.primo.page
        </a>
      </p>
      <div class="buttons">
        <button
          class="primo-button secondary"
          onclick={() => (stage = 'INPUTTING_DOMAIN')}
        >
          <Icon icon="ph:link-bold" />
          <span>Connect Custom Domain</span>
        </button>
        <button class="primo-button primary" onclick={publish_site}>
          <Icon
            icon={loading ? 'line-md:loading-twotone-loop' : 'entypo:publish'}
          />
          <span>Publish Changes</span>
        </button>
      </div>
    </div>
  {:else if stage === 'INPUTTING_DOMAIN'}
    <p class="description">
      Connect your website to a domain name. You can purchase a domain name at
      any domain name registar and connect it by changing your nameservers.
    </p>
    <div class="buttons">
      <UI.TextInput
        label="Domain name"
        placeholder="somewhere.com"
        bind:value={domain_name}
        button={{
          label: 'Connect Custom Domain',
          onclick: async () => {
            loading = true
            await setup_domain_name()
            loading = null
          },
        }}
      />
    </div>
  {:else if stage === 'CONNECTING_DOMAIN'}
    <div class="container">
      <p class="description">
        Your website is live at
        <a href="https://{$page.data.site.id}.primo.page" target="blank">
          {$page.data.site.id}.primo.page
        </a>
      </p>
      <div class="buttons">
        <button class="primo-button primary" onclick={publish_site}>
          <Icon icon="entypo:publish" />
          <span>Publish Changes</span>
        </button>
      </div>
    </div>
    <hr />
    <p class="description">
      Update your domain's nameservers at your registrar to the following to
      connect <strong>
        {domain_name}.
      </strong>
      Nameserver changes can take anywhere from a few minutes to 24 hours to fully
      propagate once updated.
    </p>
    <div>
      <div class="nameservers">
        <p>{nameservers[0]}</p>
        <p>{nameservers[1]}</p>
      </div>
      <div class="buttons">
        <button
          disabled={loading}
          class="primo-button secondary"
          onclick={async () => {
            loading = true
            await connect_domain_name()
            loading = false
          }}
        >
          {#if loading}
            <Icon icon="line-md:loading-twotone-loop" />
            <span>Checking Nameservers</span>
          {:else}
            <Icon icon="ic:outline-refresh" />
            <span>Refresh</span>
          {/if}
        </button>
      </div>
    </div>
  {:else if stage === 'DOMAIN_CONNECTED'}
    <p class="description">
      Your website is live at <a
        href="https://{$page.data.site.custom_domain}"
        target="blank"
      >
        {$page.data.site.custom_domain}
      </a>
    </p>
    <div class="buttons">
      <button
        class="primo-button primary"
        disabled={loading}
        onclick={async () => {
          loading = true
          await publish_site()
          loading = true
        }}
      >
        <Icon
          icon={loading ? 'line-md:loading-twotone-loop' : 'entypo:publish'}
        />
        <span>Publish Changes</span>
      </button>
    </div>
  {:else if stage === 'PUBLISHED'}
    {@const url =
      $page.data.site.custom_domain || `${$page.data.site.id}.primo.page`}
    <p class="description">
      Your website changes have been published to <a
        href="https://{url}"
        target="blank"
      >
        {url}
      </a>
    </p>
  {/if}
</div>

<style lang="postcss">
  hr {
    border-color: var(--color-gray-9);
    margin: 1rem 0;
  }
  .Deploy.primo-reset {
    color: white;
    background: var(--primo-color-black);
    padding: 1.125rem 1.25rem;
    display: grid;
    gap: 1rem;
    width: 100%;
  }
  .container {
    display: grid;
    gap: 1rem;
  }

  .nameservers {
    padding: 1rem;
    margin-bottom: 1rem;
    background: var(--color-gray-9);
    border-radius: var(--primo-border-radius);
  }

  .description {
    a {
      text-decoration: underline;
    }
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem;
  }
  .primo-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 7px 16px;
    background: #1f1f1f;
    border-radius: 0.25rem;
    justify-self: start;
    /* height: 100%; */
  }
  .primo-button.primary {
    border: 1px solid #35d994;
    background: transparent;
  }
  :global(form > label) {
    flex: 1;
  }
</style>
