<script>
  import '@fontsource/fira-code/index.css';
  import { browser } from '$app/environment'
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

    if (find($sites, ['id', siteID])) {
      setSitePreview(updatedSite)
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

  let data
  $: $activeSite = data
  $: siteID = $page.params.site
  $: siteID, browser && setActiveSite(siteID, $serverSites ? [...$sites, ...$serverSites] : $sites)
  $: if ($serverSites && $activeSite && find($serverSites, ['id', $activeSite.id])) {
    actions.setActiveEditor($activeSite.id)
  } 
  async function setActiveSite(siteID, sites) {
    // necessary for rollup to load (?)
    setTimeout(() => {
      const site = find(sites, ['id', siteID])
      if (site) {
        data = site.data || site
      }
    }, 500)
  }
</script>

{#if browser && data}
  <Primo
    {data}
    {role}
    {saving}
    language={$config.language}
    on:save={async ({ detail: data }) => saveData(data)}
  />
{/if}
