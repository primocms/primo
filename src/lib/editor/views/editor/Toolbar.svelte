<script>
  import { onMount, createEventDispatcher } from 'svelte'
  import { find as _find, flattenDeep } from 'lodash-es'
  import ToolbarButton from './ToolbarButton.svelte'
  import LocaleSelector from './LocaleSelector.svelte'
  import { timeline } from '../../stores/data'
  import { undo_change, redo_change } from '../../stores/actions'
  import { PrimoButton } from '../../components/buttons'
  import site from '../../stores/data/draft'
  import { id as pageID } from '../../stores/app/activePage'
  const dispatch = createEventDispatcher()
  import { page } from '$app/stores'

  export let buttons
  export let element

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

<nav
  aria-label="toolbar"
  id="primo-toolbar"
  class="primo-reset"
  bind:this={element}
  class:mounted
>
  <div class="menu-container">
    <!-- <div class="mobile-header">
      <div class="mobile-dropdowns">
        {#if !getContext('hidePrimoButton')}
          <PrimoButton on:signOut />
        {/if}
        <Dropdown options={flattenDeep(buttons)} />
      </div>
    </div> -->
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
      <!-- <a
        href="https://docs.primo.so"
        class="toolbar-link text-link"
        target="blank"
      >
        <span>{$C('Docs')}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
          ><path
            fill="currentColor"
            d="M432,320H400a16,16,0,0,0-16,16V448H64V128H208a16,16,0,0,0,16-16V80a16,16,0,0,0-16-16H48A48,48,0,0,0,0,112V464a48,48,0,0,0,48,48H400a48,48,0,0,0,48-48V336A16,16,0,0,0,432,320ZM474.67,0H316a28,28,0,0,0-28,28V46.71A28,28,0,0,0,316.79,73.9L384,72,135.06,319.09l-.06.06a24,24,0,0,0,0,33.94l23.94,23.85.06.06a24,24,0,0,0,33.91-.09L440,128l-1.88,67.22V196a28,28,0,0,0,28,28H484a28,28,0,0,0,28-28V37.33h0A37.33,37.33,0,0,0,474.67,0Z"
          /></svg
        >
      </a>
      {#if getContext('ENVIRONMENT') !== 'TRY'}
        <button
          class="toolbar-link text-link"
          on:click={() => modal.show('DIALOG', { component: 'FEEDBACK' })}
        >
          <span>{$C('Feedback')}</span>
          <svg
            aria-hidden="true"
            focusable="false"
            data-prefix="fas"
            data-icon="comment-alt-smile"
            class="svg-inline--fa fa-comment-alt-smile fa-w-16"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            ><path
              fill="currentColor"
              d="M448 0H64C28.7 0 0 28.7 0 64v288c0 35.3 28.7 64 64 64h96v84c0 9.8 11.2 15.5 19.1 9.7L304 416h144c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64zM320 133.2c14.8 0 26.8 12 26.8 26.8s-12 26.8-26.8 26.8-26.8-12-26.8-26.8 12-26.8 26.8-26.8zm-128 0c14.8 0 26.8 12 26.8 26.8s-12 26.8-26.8 26.8-26.8-12-26.8-26.8 12-26.8 26.8-26.8zm164.2 140.9C331.3 303.3 294.8 320 256 320c-38.8 0-75.3-16.7-100.2-45.9-5.8-6.7-5-16.8 1.8-22.5 6.7-5.7 16.8-5 22.5 1.8 18.8 22 46.5 34.6 75.8 34.6 29.4 0 57-12.6 75.8-34.7 5.8-6.7 15.9-7.5 22.6-1.8 6.8 5.8 7.6 15.9 1.9 22.6z"
            /></svg
          >
        </button>
      {/if} -->
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
