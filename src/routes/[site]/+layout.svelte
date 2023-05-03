<script>
  import { onDestroy } from 'svelte'
  import { browser } from '$app/environment'
  import Primo, { stores } from '$lib/editor'
  import modal from '$lib/editor/stores/app/modal'
  import { page } from '$app/stores'
  import Sidebar from './Sidebar.svelte'
  import IconButton from '$lib/components/IconButton.svelte'
  import HSplitPane from '$lib/editor/views/modal/ComponentEditor/HSplitPane.svelte'

  export let data

  let showing_sidebar = false

  let leftPaneSize = browser
    ? showing_sidebar
      ? window.innerWidth / 5 + `px`
      : '0px'
    : '200px'
  let rightPaneSize = browser
    ? showing_sidebar
      ? (window.innerWidth / 5) * 5 + 'px'
      : 'auto'
    : 'auto'

  $: if (parseInt(leftPaneSize) < 100) {
    leftPaneSize = '20px'
    rightPaneSize = '100%'
    showing_sidebar = false
  } else if (parseInt(leftPaneSize) >= 100 && !showing_sidebar) {
    reset()
  }

  function reset() {
    leftPaneSize = browser ? window.innerWidth / 5 + 'px' : '0px'
    rightPaneSize = browser ? (window.innerWidth / 5) * 5 + 'px' : '0px'
    showing_sidebar = true
  }

  let siteLocked = false

  let saving = false

  onDestroy(() => {
    if (siteLocked) modal.hide()
  })
</script>

<main>
  <HSplitPane bind:leftPaneSize bind:rightPaneSize>
    <div slot="left">
      {#if showing_sidebar}
        <Sidebar />
      {:else}
        <div class="expand primo-reset">
          <IconButton
            on:click={reset}
            icon="tabler:layout-sidebar-left-expand"
          />
        </div>
      {/if}
    </div>
    <div slot="right">
      <slot />
    </div>
  </HSplitPane>
</main>

<Primo {data} page_id={$page.params.page} {saving} />

<div id="app-version">
  <!-- <span>primo v{primo.version}</span> -->
  <!-- <span>server v{__SERVER_VERSION__}</span> -->
</div>

<style lang="postcss">
  main {
    overflow: hidden;
    transition: 0.1s;
    height: calc(100vh - 54px);
    overflow: hidden;
    transition: 0.1s;
    margin-top: 54px;
  }
  [slot='right'] {
    width: 100%;
  }
  [slot='left'] {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #121212;
    color: white;
  }
  .expand {
    height: 100%;
    display: flex;
  }
</style>
