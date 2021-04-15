<script>
  import _ from 'lodash'
  import Editor from './Editor.svelte'
  import { wrapInStyleTags } from '../../utils'

  import tailwind from '../../stores/data/tailwind'
  import {styles as siteStyles} from '../../stores/data/draft'
  import {
    id, 
    styles as pageStyles, 
    wrapper as pageWrapper
  } from '../../stores/app/activePage'
  import {unsaved} from '../../stores/app/misc'
  import site from '../../stores/data/site'

  function savePage() {
    $unsaved = false
    site.save()
  }

</script>

<svelte:head>
  {@html wrapInStyleTags($tailwind, 'tailwind')}
  {@html $pageWrapper.head.final}
  {@html wrapInStyleTags($siteStyles.final, 'site-styles')}
  {@html wrapInStyleTags($pageStyles.final, "page-styles")}
</svelte:head>

<Editor on:change on:save={savePage} on:build on:signOut />