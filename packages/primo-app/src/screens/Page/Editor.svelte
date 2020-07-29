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

  import {site,repo,domainInfo,user,pageData} from '@stores/data'
  import {content} from '@stores/data/page'
  import {focusedNode, modal,editorViewDev} from '@stores/app'

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
      },
      {
        title: 'Symbol Library',
        icon: 'clone',
        onclick: () => modal.show('COMPONENT_LIBRARY', {
          button: {
            onclick: addComponentToPage
          }
        }) 
      },
      {
        title: 'Page Section',
        icon: 'columns',
        onclick: () => modal.show('PAGE_SECTIONS') 
      },
    ],
    [
      {
        id: 'pages',
        title: 'Pages',
        icon: 'th-large',
        onclick: () => modal.show('SITE_PAGES') 
      },
      {
        title: 'Content', 
        icon: 'database', 
        onclick: () => modal.show('FIELDS', { 
          fields: $pageData.fields, 
          onsave: (fields) => {
            pageData.save('fields', fields)
          } 
        }, { 
          header: {
            title: 'Content',
            icon: 'fas fa-database'
          } 
        })
      }
    ]
  ]

  const developerButtons = [
    [
      {
        title: 'Content',
        icon: 'heading',
        buttons: _.flatten(editorialButtons)
      },
      {
        title: 'Single-use Component',
        icon: 'code',
        onclick: () => modal.show('COMPONENT_EDITOR', {
          button: {
            label: 'Add to page',
            onclick: addComponentToPage
          }
        })
      },
      {
        title: 'Symbol',
        icon: 'clone',
        onclick: () => modal.show('COMPONENT_LIBRARY', {
          button: {
            onclick: addComponentToPage
          }
        }) 
      },
      {
        title: 'Section',
        icon: 'columns',
        onclick: () => modal.show('PAGE_SECTIONS') 
      },
    ],
    [
      {
        title: 'Dependencies',
        icon: 'cube',
        onclick: () => modal.show('DEPENDENCIES'),
      },
      {
        title: 'HTML',
        icon: 'fab fa-html5',
        onclick: () => modal.show('WRAPPER'),
      },
      {
        id: 'site-styles',
        title: 'CSS',
        icon: 'fab fa-css3',
        onclick: () => modal.show('STYLES')
      }
    ],
    [
      {
        id: 'pages',
        title: 'Pages',
        icon: 'th-large',
        onclick: () => modal.show('SITE_PAGES') 
      }
    ],
    [
      {
        id: 'site-settings',
        title: 'Fields',
        icon: 'database',
        onclick: () => modal.show('FIELDS', { 
          fields: $site.fields, 
          onsave: (fields) => {
            site.save({fields})
          } 
        }, { 
          header: {
            title: 'Fields',
            icon: 'fas fa-database'
          } 
        })
      }
    ],
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
  $: toolbarButtons = $editorViewDev ? developerButtons : editorButtons

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

<Toolbar buttons={toolbarButtons} let:showKeyHint={showKeyHint} on:toggleView={() => editorViewDev.set(!$editorViewDev)}>
  <ToolbarButton id="save" title="Save" icon="save" key="s" {showKeyHint} loading={updatingDatabase} on:click={savePage} disabled={!unsavedContentExists} variant="outlined" buttonStyles="mr-1 bg-gray-600" />
  {#if $editorViewDev}
    <ToolbarButton type="primo" icon="fas fa-hammer" on:click={() => modal.show('BUILD')} disabled={updatingDatabase} variant="bg-gray-200 text-gray-900 hover:bg-gray-400" />
  {:else}
    <ToolbarButton type="primo" on:click={() => modal.show('BUILD')} disabled={updatingDatabase}>publish</ToolbarButton>
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
  <script src="https://twitter.github.io/typeahead.js/js/handlebars.js"></script>
  <!-- <script src="https://cdn.jsdelivr.net/npm/handlebars@latest/dist/handlebars.js"></script> -->
  <!-- <script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.6/handlebars.min.js" integrity="sha512-zT3zHcFYbQwjHdKjCu6OMmETx8fJA9S7E6W7kBeFxultf75OPTYUJigEKX58qgyQMi1m1EgenfjMXlRZG8BXaw==" crossorigin="anonymous"></script> -->
</svelte:head>