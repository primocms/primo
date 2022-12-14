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

  let themes = null
  axios.get('https://api.primo.so/themes').then(({data}) => {
    themes = data
  })

  let selectedTheme = null
  function selectTheme(theme) {
    selectedTheme = theme.name
    track('SELECT_THEME', { id: theme.data.id })
    const data = _.cloneDeep(theme.data)
    delete data.name
    delete data.id
    dispatch('submit', data)
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
  <a href="https://primo.so/marketplace" class="primo--link" target="_blank">
    <span>More in the Marketplace</span>
    <Icon icon="charm:link-external" />
  </a>
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