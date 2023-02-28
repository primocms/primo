<script>
  import { onDestroy, setContext } from 'svelte'
  import { browser } from '$app/environment'
  import Primo, { stores } from '$lib/editor'
  import modal from '$lib/editor/stores/app/modal'
  import * as actions from '../../actions'
  import user from '../../stores/user'
  import { sitePassword } from '../../stores/misc'
  import { activeSite } from '../../stores/site'
  import { page } from '$app/stores'
  // import * as primo from '../../package.json'
  import config from '../../stores/config'
  import LockAlert from '$lib/components/LockAlert.svelte'

  $: siteID = $page.params.site

  let currentPath
  let siteLocked = false
  async function fetchSite(fullPath) {
    if (currentPath === fullPath) return
    currentPath = fullPath
    const res = await actions.sites.get(siteID)
    if (res?.active_editor && res.active_editor !== $user.email) {
      siteLocked = true
      modal.show('DIALOG', {
        component: LockAlert,
        componentProps: {
          email: res.active_editor,
          canGoToDashboard: false,
        },
        options: {
          disableClose: true,
        },
      })
    } else if (res) {
      actions.setActiveEditor({ siteID })
      $activeSite = res
    }
  }

  async function saveData(updatedSite) {
    saving = true
    const success = await actions.sites.save(updatedSite)
    stores.saved.set(success)
    saving = false
  }

  let saving = false

  $: if ($user.signedIn && browser) fetchSite($page.url.pathname)

  $: if (browser && $sitePassword) {
    setContext('hidePrimoButton', true)
  }

  onDestroy(() => {
    if (browser && !siteLocked) actions.setActiveEditor({ siteID, lock: false })
    else if (siteLocked) modal.hide()
  })
</script>

<Primo
  data={$activeSite}
  page_id={$page.params.page}
  role={$user.role}
  options={{
    logo: $config.customization.logo.url,
  }}
  {saving}
  on:save={async ({ detail: data }) => saveData(data)}
/>
<slot />
<div id="app-version">
  <!-- <span>primo v{primo.version}</span> -->
  <span>server v{__SERVER_VERSION__}</span>
</div>

<style global lang="postcss">
  .primo-reset {
    @tailwind base;
    font-family: 'Satoshi', sans-serif !important;

    button,
    button * {
      cursor: pointer;
    }
  }

  body {
    margin: 0;
  }

  #app-version {
    font-family: 'Satoshi', sans-serif;
    font-size: 0.75rem;
    color: var(--color-gray-4);
    position: fixed;
    bottom: 0.5rem;
    left: 0.5rem;

    span:first-child {
      margin-right: 0.5rem;
    }
  }
</style>
