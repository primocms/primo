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
  import {unsaved} from '../../stores/app/misc'
  import site from '../../stores/data/site'

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

  function savePage() {
    $unsaved = false
    site.save()
  }

</script>


<svelte:head>
  {@html $pageWrapper.head.final}
  {@html wrapInStyleTags($tailwind, 'tailwind')}
  {@html wrapInStyleTags($siteStyles.final, 'site-styles')}
  {@html wrapInStyleTags($pageStyles.final, "page-styles")}

  {#each cssLibraries as library}
    <link href="${library.src}" rel="stylesheet" />
  {/each}
</svelte:head>

<Editor on:change on:save={savePage} on:build on:signOut />

<!-- {#if $loadingTailwind}
  <div class="flex" id="loading" transition:fade={{ duration: 200 }}>
    <span class="text-white text-xs mr-2">Loading Tailwind styles</span>
    <Spinner variants="text-white" size="xs"/>
  </div>
{/if} -->

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