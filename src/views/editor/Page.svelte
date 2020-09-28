<script lang="ts">
  import _ from 'lodash'
  import {setContext} from 'svelte'
  import Editor from './Editor.svelte'
  import { wrapInStyleTags } from '../../utils'

  import tailwind from '../../stores/data/tailwind'
  import {styles as siteStyles} from '../../stores/data/draft'
  import {
    id, 
    styles as pageStyles, 
    dependencies as pageDependencies,
    wrapper as pageWrapper
  } from '../../stores/app/activePage'

  export let route : string
	$: id.set(route) 

  let libraries: Array<any>;
  $: libraries = $pageDependencies ? $pageDependencies.libraries : [];

  let customScripts: Array<any> = [];

  let cssLibraries: Array<any>;
  $: cssLibraries = libraries.filter((l) => l.type === "css");

  let jsLibraries: Array<any>;
  $: jsLibraries = libraries.filter((l) => l.type === "js");

  function containsField(row, fieldType) {
    return _.some(row.value.raw.fields, ["type", fieldType]);
  }

  // This is how we use SystemJS to get modules working inside components
  let importMap: string;
  $: importMap = JSON.stringify({
    imports: _.mapValues(
      _.keyBy(
        jsLibraries,
        "name"
      ),
      "src"
    ),
  });

  let systemJsNode;
  $: {
    if (systemJsNode) {
      systemJsNode.innerHTML = importMap;
    }
  }

</script>

<style>
  #loading {
    @apply fixed font-medium rounded-full bg-primored py-1 px-3 shadow-lg;
    left: 0.5rem;
    bottom: 0.5rem;
    z-index: 99999999999;
  }

  #primo-symbol {
    width: 3rem;
    height: 2rem;
  }

  /* remove random annoying Monaco alert that sometimes shows up at the bottom of the page */
  :global(.monaco-alert) {
    display: none !important;
  }
</style>

<svelte:head>
  {@html $pageWrapper.head.final}
  <link
    href="https://unpkg.com/tailwindcss@^1.0/dist/tailwind.min.css"
    rel="stylesheet"
    type="text/css" />
  {@html wrapInStyleTags($tailwind, 'tailwind')}
  {@html wrapInStyleTags($siteStyles.final, 'site-styles')}
  {@html wrapInStyleTags($pageStyles.final, "page-styles")}

  {#each cssLibraries as library}
    <link href="${library.src}" rel="stylesheet" />
  {/each}
  {#if jsLibraries.length > 0}
    <script type="systemjs-importmap" bind:this={systemJsNode}>
    </script>
  {/if}
</svelte:head>

<Editor on:change on:save on:build on:signOut />

<!-- {#if $loadingTailwind}
  <div class="flex" id="loading" transition:fade={{ duration: 200 }}>
    <span class="text-white text-xs mr-2">Loading Tailwind styles</span>
    <Spinner variants="text-white" size="xs"/>
  </div>
{/if} -->
