<script>
  import {createEventDispatcher, getContext} from 'svelte'
  import {fade} from 'svelte/transition'
  import _ from 'lodash-es'
  import axios from '$lib/libraries/axios'
  import { _ as C } from 'svelte-i18n'
  import Icon from '@iconify/svelte'
  import ThemeThumbnail from '$lib/components/ThemeThumbnail.svelte'
  import Button from '@primo-app/primo/components/buttons/Button.svelte'
  import Spinner from '$lib/ui/Spinner.svelte'

  const dispatch = createEventDispatcher()
  const track = getContext('track')

  let theme_ids = []
  let themes = null
  fetch_themes()

  async function fetch_themes(ids) {
    const {data} = await axios.get('https://api.primo.so/themes')
    theme_ids = data

    themes = await Promise.all(
      theme_ids.map(async id => {
        const {data} = await axios.get(`https://api.primo.so/themes/${id}?preview`)
        return {
          id,
          name: data.name, 
          preview: data.preview
        }
      })
    )
  }

  let selectedTheme = null
  async function selectTheme(theme) {
    track('SELECT_THEME', { name: theme.name })
    selectedTheme = theme.name
    const {data:site} = await axios.get(`https://api.primo.so/themes/${theme.id}?data`)
    delete site.name
    delete site.id
    dispatch('submit', site)
  }

</script>

<div in:fade>
  <header>
    <button class="primo--link" on:click={() => dispatch('back')}>
      <Icon icon="material-symbols:arrow-back-rounded" />
      <span>Go back</span>
    </button>
  </header>
  <h2 class="primo-heading-lg">
    <span>{$C('dashboard.create.pick')}</span>
  </h2>
  <div class="themes">
    {#if !themes}
      <Spinner />
    {:else}
      {#each themes as theme}
        <ThemeThumbnail selected={selectedTheme === theme.name} on:click={() => selectTheme(theme)} title={theme.name} site={theme.data} preview={theme.preview} />
      {/each}
    {/if}
  </div> 
  <!-- <a href="https://primo.so/marketplace" class="primo--link" target="_blank">
    <span>More in the Marketplace</span>
    <Icon icon="charm:link-external" />
  </a> -->
  <Button
    on:click={() => dispatch('create')}
    label={$C('dashboard.create.button.create')}
    disabled={!selectedTheme}
  />
</div>

<style>
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .primo--link {
    font-size: 0.75rem;
    border-bottom: 1px solid;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
  }
</style>