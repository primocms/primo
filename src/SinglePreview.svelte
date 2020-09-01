<script>
  import { onMount, onDestroy } from 'svelte'
  import _ from 'lodash'
  import { fade } from 'svelte/transition'
  import {WebDeveloper} from './@svg';
  import {wrapInStyleTags} from './utils'
  import {getHeadStyles,getPageLibraries,setHeadScript,setPageJsLibraries,appendHtml,setCustomScripts} from './screens/Page/pageUtils.js'
  import store from './@libraries/store.js'

  export let previewId

  const { dependencies, id, html, css, js } = store.get(`preview-${previewId}`) || {}

  let previewHTML = html
  let previewCSS = wrapInStyleTags(css)

  store.on(`preview-${previewId}`, ({ newValue:value }) => {
    previewCSS = wrapInStyleTags(value.css)
    previewHTML = value.html
  })

  let tailwindStyles = store.get('tailwind')

  store.on(`tailwind`, ({ newValue:value }) => {
    tailwindStyles = value
  })

</script>

<svelte:head>
  {@html wrapInStyleTags(tailwindStyles)}
  {@html previewCSS}
</svelte:head>

<div class="primo-page" in:fade={{ duration: 100 }}>
  {@html previewHTML}
</div>

<style global>

  .primo-page {
    @apply w-full h-full;
  }
  
</style>