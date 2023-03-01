<script>
  import { browser } from '$app/environment'
  import Page from '$lib/editor/views/editor/Page.svelte'
  import Sidebar from './Sidebar.svelte'
  // import IconButton from '$lib/components/IconButton.svelte'
  import HSplitPane from '$lib/editor/views/modal/ComponentEditor/HSplitPane.svelte'

  export let data
  let showing_sidebar = false

  let leftPaneSize = browser ? window.innerWidth / 5 + `px` : '200px'
  let rightPaneSize = browser ? (window.innerWidth / 5) * 5 + 'px' : 'auto'

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
</script>

<main>
  <HSplitPane bind:leftPaneSize bind:rightPaneSize>
    <div slot="left">
      {#if showing_sidebar}
        <Sidebar />
      {:else}
        <div class="expand primo-reset">
          <!-- <IconButton
            on:click={reset}
            icon="tabler:layout-sidebar-left-expand"
          /> -->
        </div>
      {/if}
    </div>
    <div slot="right">
      <Page id="index" {data} />
    </div>
  </HSplitPane>
</main>

<style lang="postcss">
  main {
    height: calc(100vh - 52px);
    overflow: hidden;
    margin-top: 84px;
    transition: 0.1s;
  }

  [slot='right'] {
    width: 100%;
  }

  .expand {
    height: calc(100vh - 52px);
    position: fixed;
    bottom: 0;
    left: 0;
    display: flex;
    cursor: pointer;
  }
</style>
