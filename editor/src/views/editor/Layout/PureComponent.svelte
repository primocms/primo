<script>
  import { onMount } from 'svelte';
  import _ from 'lodash-es'
  import { fade } from 'svelte/transition';

  import ContentNode from './ContentNode.svelte';
  import ComponentNode from './ComponentNode.svelte';

  export let block

  let node

  let mounted 
  onMount(() => {
    mounted = true
  })
</script>

<div
  bind:this={node}
  in:fade={{duration:100}}
  class:visible={mounted}
  class="primo-section has-{block.type}"
  id="{block.id}"
>
  {#if block.type === 'component'}
    <ComponentNode {block} {node} />
  {:else if block.type === 'content'}
    <ContentNode {block} />
  {/if}
</div>

<style lang="postcss">
  .primo-section {
    position: relative;
    min-height: 3rem;
  }
  .component {
    position: relative;
    outline: 5px solid transparent;
    outline-offset: -5px;
    transition: outline-color 0.2s;
    outline-color: transparent;
    width: 100%;
    min-height: 2rem;
  }
  :global(#primo-desktop-toolbar) {
    display: none !important;
  }
</style>