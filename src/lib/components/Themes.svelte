<script>
  import Icon from '@iconify/svelte'
  import { createEventDispatcher } from 'svelte'
  import _ from 'lodash-es'
  import axios from 'axios'
  import ThemeThumbnail from '$lib/components/ThemeThumbnail.svelte'
  import { validate_site_structure_v2 } from '@primocms/builder'

  const dispatch = createEventDispatcher()

  let themes = []
  axios
    .get(
      'https://primosites.vercel.app/api/primo-landing-page/themes?sections=ff5c3e56-690b-4220-abe9-9f02a74e1599',
    )
    .then(({ data }) => {
      const [section] = data.sections
      themes = section.templates.filter((template) => template.price === '0' && template.available)
    })

  let selectedTheme = null
  async function selectTheme(theme) {
    const { data } = await axios.get(
      `https://raw.githubusercontent.com/${theme.repo}/main/primo.json`,
    )
    const validated = validate_site_structure_v2(data)
    selectedTheme = theme.name
    dispatch('select', validated)
  }

  let active_theme_page = 0
  $: active_themes =
    themes.length > 0 ? themes.slice(active_theme_page * 4, active_theme_page * 4 + 4) : []
</script>

<header>
  <h2 class="heading">Themes</h2>
  {#if themes.length > 0}
    <div class="buttons">
      <button on:click={() => active_theme_page--} type="button" disabled={active_theme_page === 0}>
        <Icon icon="ic:round-chevron-left" />
      </button>
      <button
        on:click={() => active_theme_page++}
        disabled={active_theme_page >= themes.length / 4 - 1}
        type="button"
      >
        <Icon icon="ic:round-chevron-right" />
      </button>
    </div>
  {/if}
</header>
<div class="themes">
  {#each active_themes as theme (theme.name)}
    <ThemeThumbnail
      selected={selectedTheme === theme.name}
      on:click={() => selectTheme(theme)}
      title={theme.name}
      preview={theme.screenshots.desktop.url}
    />
  {/each}
</div>

<style lang="postcss">
  header {
    display: flex;
    justify-content: space-between;

    h2 {
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }
  }
  button {
    font-size: 1.25rem;
    &:not(:disabled):hover {
      color: var(--primo-color-brand);
    }
    &:disabled {
      opacity: 0.25;
      cursor: initial;
    }
  }
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    place-items: start;
    gap: 1rem;
    margin-bottom: 1rem;
  }
</style>
