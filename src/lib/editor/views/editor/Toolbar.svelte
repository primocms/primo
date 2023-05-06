<script>
  import { onMount, createEventDispatcher } from 'svelte'
  import { find as _find, flattenDeep } from 'lodash-es'
  import ToolbarButton from './ToolbarButton.svelte'
  import LocaleSelector from './LocaleSelector.svelte'
  import { timeline } from '../../stores/data'
  import { undo_change, redo_change } from '../../stores/actions'
  import { PrimoButton } from '../../components/buttons'
  import site from '../../stores/data/site'
  import { id as pageID } from '../../stores/app/activePage'
  import { page } from '$app/stores'

  export let buttons

  let mounted = false
  onMount(() => {
    mounted = true
  })

  let channel
  $: if (!import.meta.env.SSR) {
    channel = new BroadcastChannel('site_preview')
  }

  async function showPreview() {
    channel.onmessage = ({ data }) => {
      if (data === 'READY') {
        channel.postMessage({
          site: $site,
          pageID: $pageID,
        })
      }
    }
    window.primo.createPopup()
  }
</script>

<nav aria-label="toolbar" id="primo-toolbar" class="primo-reset" class:mounted>
  <div class="menu-container">
    <div class="left">
      <PrimoButton on:signOut />
      <div class="buttons">
        {#each buttons as button}
          {#if Array.isArray(button)}
            {@const group = button}
            <div class="button-group">
              {#each group as button}
                <ToolbarButton {...button} />
              {/each}
            </div>
          {:else}
            <div class="icon-button">
              <ToolbarButton {...button} />
            </div>
          {/if}
        {/each}
      </div>
    </div>
    {#if $page.data.site}
      <div class="site-name">
        <span class="site">{$page.data.site.name} /</span>
        <span class="page">{$page.data.page.name}</span>
      </div>
    {/if}
    <div class="right">
      {#if !$timeline.first}
        <ToolbarButton
          id="undo"
          title="Undo"
          icon="material-symbols:undo"
          on:click={undo_change}
        />
      {/if}
      {#if !$timeline.last}
        <ToolbarButton
          id="redo"
          title="Redo"
          icon="material-symbols:redo"
          on:click={redo_change}
        />
      {/if}
      <LocaleSelector />
      <slot />
    </div>
  </div>
</nav>

<style lang="postcss">
  #primo-toolbar {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    z-index: 99999999;
    border-bottom: 1px solid var(--color-gray-8);
  }

  button.create-preview {
    padding: 0 0.5rem;
    background: var(--primo-color-codeblack);
    border-radius: var(--primo-border-radius);
  }

  .left {
    /* width: 100%; */
    display: flex;
    justify-content: flex-start;
    gap: 1rem;
  }

  .buttons {
    display: flex;
    margin-left: 0.25rem;
  }

  .left .button-group {
    display: flex;
    flex-direction: row;
  }

  .site-name {
    font-size: 14px;
    .site {
      color: #b6b6b6;
    }
    .page {
      color: white;
    }

    @media (max-width: 670px) {
      display: none;
    }
  }

  .menu-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 auto;
    padding: 0.5rem 1rem;
  }

  .menu-container:after {
    background: #121212;
    content: '';
    z-index: -1;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    backdrop-filter: blur(10px);
  }

  .right {
    display: flex;
    align-items: center;
    /* gap: 1rem; */
  }

  .button-group {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
  }
</style>
