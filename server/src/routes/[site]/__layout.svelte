<script>
  import { onDestroy } from 'svelte'
  import { browser } from '$app/env'
  import Primo, {
    modal as primoModal,
    PrimoFieldTypes,
    fieldTypes,
    stores,
  } from '@primo-app/primo'
  import modal from '@primo-app/primo/src/stores/app/modal'
  import Build from '../../extensions/Build.svelte'
  import ImageField from '../../extensions/FieldTypes/ImageField.svelte'
  import * as actions from '../../actions'
  import user from '../../stores/user'
  import { sitePassword } from '../../stores/misc'
  import { page } from '$app/stores'
  import * as primo from '@primo-app/primo/package.json'
  import { setActiveEditor } from '../../supabase/helpers'
  import LockAlert from '$lib/components/LockAlert.svelte'

  primoModal.register([
    {
      id: 'BUILD',
      component: Build,
      componentProps: {
        siteName: 'Website', // TODO - change
      },
      options: {
        route: 'build',
        width: 'md',
        header: {
          title: 'Build to Github',
          icon: 'fab fa-github',
        },
      },
    },
  ])

  let currentPath
  async function fetchSite(fullPath) {
    if (currentPath === fullPath) return
    currentPath = fullPath
    const res = await actions.sites.get(siteID, $sitePassword)
    if (res?.active_editor && res.active_editor !== $user.email) {
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
      setActiveEditor(siteID)
      data = res
    }
  }

  async function saveData(updatedSite) {
    saving = true
    const success = await actions.sites.save(updatedSite, $sitePassword)
    stores.saved.set(success)
    saving = false
  }

  fieldTypes.register([
    {
      id: 'image',
      label: 'Image',
      component: ImageField,
    },
    ...PrimoFieldTypes,
  ])

  let saving = false

  $: siteID = $page.params.site

  let data
  $: if ($user.signedIn && browser) fetchSite($page.url.pathname)
</script>

{#if browser}
  <Primo
    {data}
    role={$user.role}
    {saving}
    on:save={async ({ detail: data }) => saveData(data)}
  />
  <div id="app-version">
    <span>primo v{primo.version}</span>
    <span>server v{__SERVER_VERSION__}</span>
  </div>
{/if}

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
