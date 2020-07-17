<script lang="ts">
  import Mousetrap from 'mousetrap'
  import _ from 'lodash'
  import { onMount, createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import store from '@libraries/store.js'

  const dispatch = createEventDispatcher()
  
  import Toolbar from './editor/Toolbar.svelte'
  import ToolbarButton from './editor/ToolbarButton.svelte'
  import Doc from './editor/Doc.svelte'

  import {processStyles} from 'utils'

  import {getDomainData} from '@fb/firestore/domains'

  import {content,site,repo,domainInfo,user} from '@stores/data'
  import {focusedNode, modal} from '@stores/app'

  import {Button,ButtonGroup,Component} from './editor/Layout/LayoutTypes'

  let unlockingPage:boolean = false
  let updatingDatabase:boolean = false
  let unsavedContentExists:boolean = false

  let mounted:boolean = false
  onMount(async () => {
    // const domainData = await getDomainData()
    // $repo = domainData.repo
    mounted = true
  })

  // setup key-bindings
  Mousetrap.bind(['mod+s'], (e) => {
    e.preventDefault()
    savePage()
  })

  const editorialButtons:Array<ButtonGroup> = [
    [ 
      {
        title: 'Heading', 
        icon: 'heading', 
        key: 'h',
        id: 'h1'
      },
      {
        title: 'Subheading', 
        icon: 'heading heading2', 
        id: 'h2'
      },
    ],
    [
      {
        title: 'Bold', 
        icon: 'bold', 
        key: 'b',
        id: 'bold'
      },
      {
        title: 'Italic', 
        icon: 'italic', 
        key: 'i',
        id: 'italic'
      },
      {
        title: 'Highlight', 
        icon: 'highlighter', 
        key: 'l',
        id: 'highlight'
      }
    ],
    [
      {
        title: 'Link', 
        icon: 'link', 
        key: 'k',
        id: 'link'
      }
    ],
    [
      {
        title: 'CodeFormat', 
        icon: 'code', 
        id: 'code'
      },
      {
        title: 'Quote', 
        icon: 'quote-left',
        id: 'blockquote'
      }
    ],
    [
      {
        title: 'Unordered List', 
        icon: 'list-ul', 
        id: 'ul'
      },
      {
        title: 'Ordered List', 
        icon: 'list-ol', 
        id: 'ol'
      }
    ],
  ]

  const editorButtons = [
    [
      {
        title: 'Content',
        icon: 'heading',
        buttons: _.flatten(editorialButtons)
      }
    ],
    [
      {
        title: 'Page Section',
        icon: 'columns',
        onclick: () => modal.show('PAGE_SECTIONS') 
      },
      {
        title: 'Symbol Library',
        icon: 'th-large',
        onclick: () => modal.show('COMPONENT_LIBRARY', {
          button: {
            onclick: addComponentToPage
          }
        }) 
      },
    ],
    [
      {
        id: 'pages',
        title: 'Pages',
        icon: 'file',
        onclick: () => modal.show('SITE_PAGES') 
      },
      {
        title: 'Settings', 
        icon: 'cog', 
        onclick:  () => modal.show('PAGE_SETTINGS') 
      }
    ]
  ]

  const developerButtons = [
    [
      {
        title: 'Content',
        icon: 'heading',
        buttons: _.flatten(editorialButtons)
      }
    ],
    [
      {
        title: 'Create Component',
        icon: 'code',
        onclick: () => modal.show('COMPONENT_EDITOR', {
          button: {
            label: 'Add to page',
            onclick: addComponentToPage
          }
        })
      },
      {
        title: 'Symbol Library',
        icon: 'th-large',
        onclick: () => modal.show('COMPONENT_LIBRARY', {
          button: {
            onclick: addComponentToPage
          }
        }) 
      },
    ],
    [
      {
        title: 'Page Section',
        icon: 'columns',
        onclick: () => modal.show('PAGE_SECTIONS') 
      },
    ],
    [
      {
        title: 'Page Dependencies',
        icon: 'cube',
        onclick: () => modal.show('DEPENDENCIES'),
      },
      {
        title: 'Page Styles',
        icon: 'fab fa-css3',
        onclick: () => modal.show('PAGE_STYLES') 
      },
      {
        title: 'Page Settings',
        icon: 'cog',
        onclick: () => modal.show('PAGE_SETTINGS')
      },
    ],
    [
      {
        id: 'pages',
        title: 'Pages',
        icon: 'file',
        onclick: () => modal.show('SITE_PAGES') 
      }
    ],
    [
      {
        id: 'site-styles',
        title: 'Site Styles',
        icon: 'fab fa-css3',
        onclick: () => modal.show('SITE_STYLES')
      },
      {
        id: 'site-settings',
        title: 'Site Settings',
        icon: 'cog',
        onclick: () => modal.show('SITE_SETTINGS')
      },
    ]
  ]

  function addComponentToPage(component:Component): void {
    unsavedContentExists = true
    content.saveRow(component)
    modal.hide()
  }

  function savePage(): void {
    content.save()
    dispatch('save')
    unsavedContentExists = false
    updatingDatabase = true
    setTimeout(() => {
      updatingDatabase = false
    }, 1000) 
  }

  let toolbarButtons:Array<ButtonGroup>
  $: toolbarButtons = $user.role === 'developer' || !$user.role ? developerButtons : editorButtons

  // Show 'are you sure you want to leave prompt' when closing window 
  $: if (unsavedContentExists && !$domainInfo.onDev) {
    window.onbeforeunload = function(e){
      e.returnValue = '';
    };
  } else {
    window.onbeforeunload = function(e){
      delete e['returnValue'];
    };
  }

</script>

<Toolbar buttons={toolbarButtons} let:showKeyHint={showKeyHint}>
  <ToolbarButton id="save" title="Save" icon="save" key="s" {showKeyHint} loading={updatingDatabase} on:click={savePage} disabled={!unsavedContentExists} variant="outlined" buttonStyles="mr-1 bg-gray-600" />
  {#if $user.role === 'developer' && mounted}
    <ToolbarButton icon="fab fa-github" on:click={() => modal.show('PUBLISH')} disabled={updatingDatabase} variant="bg-gray-200 text-gray-900 hover:bg-gray-400" />
  {:else if mounted}
    <ToolbarButton on:click={() => modal.show('PUBLISH')} disabled={updatingDatabase} variant="bg-primored text-gray-100">publish</ToolbarButton>
  {/if}
</Toolbar>
<Doc 
on:contentChanged={() => {
  unsavedContentExists = true
  dispatch('change')
}}
on:componentEditClick={({detail:component}) => {
  modal.show('COMPONENT_EDITOR', { 
    component,
    button: {
      label: 'Save Component',
      onclick: (component) => {
        unsavedContentExists = true
        content.saveRow(component)
        modal.hide()
      }
    }
  }, {
    header: {
      title: 'Edit Component',
      icon: 'fas fa-code'
    }
  })
}}
/>

<svelte:head>
  <script src="https://cdn.jsdelivr.net/npm/handlebars@latest/dist/handlebars.js"></script>
</svelte:head>