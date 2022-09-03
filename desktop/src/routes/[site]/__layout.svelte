<script context="module">
  export const ssr = false
</script>

<script>
  import '@fontsource/fira-code/index.css';
  import { browser } from '$app/env'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import Primo, {
    modal as primoModal,
    Site,
    stores,
  } from '@primo-app/primo'
  import { find } from 'lodash-es'
  import sites from '../../stores/sites'
  import serverSites from '../../stores/serverSites'
  import activeSite from '../../stores/activeSite'
  import Build from '../../extensions/Build.svelte'
  import { page } from '$app/stores'
  import * as actions from '$lib/actions'
  import {setSitePreview, storeSite} from '$lib/actions'
  import config from '../../stores/config'

  if (browser) {
    primoModal.register([
      {
        id: 'BUILD',
        component: Build,
        componentProps: {
          siteName: 'Website', // TODO - change
        },
        options: {
          route: 'build',
          width: 'small',
          header: {
            title: 'Build to Github',
            icon: 'fab fa-github',
          },
          hideLocaleSelector: true
        },
      },
    ])
  }

  let role = 'developer'

  async function saveData(updatedSite) {
    saving = true
    setSitePreview(updatedSite)

    if (find($sites, ['id', siteID])) {
      $sites = $sites.map((site) => {
        if (site.id !== siteID) return site
        return {
          ...site,
          data: updatedSite,
        }
      })
      storeSite(updatedSite)
      stores.saved.set(true)
    } else if (find($serverSites, ['id', siteID])) {
      const success = await actions.serverSites.save(updatedSite)
      stores.saved.set(success)
      if (!get(stores.saved)) {
        window.alert('Could not save site. See console for details.')
      }
    }

    saving = false
  }

  let saving = false

  let mounted = false
  onMount(() => (mounted = true))

  $: siteID = $page.params.site
  $: data = $activeSite || Site({ id: 'test', name: 'Test' })
  $: mounted && setActiveSite(siteID, $serverSites ? [...$sites, ...$serverSites] : $sites)
  $: if ($serverSites && find($serverSites, ['id', $activeSite.id])) {
    actions.setActiveEditor($activeSite.id)
  } 
  async function setActiveSite(siteID, sites) {
    // necessary for rollup to load (?)
    setTimeout(() => {
      const site = find(sites, ['id', siteID])
      if (site) {
        $activeSite = site.data || site
      }
    }, 500)
  }
</script>

{#if browser}
  <Primo
    {data}
    {role}
    {saving}
    language={$config.language}
    on:save={async ({ detail: data }) => saveData(data)}
  />
{/if}
