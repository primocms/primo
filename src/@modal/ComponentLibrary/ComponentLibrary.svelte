<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  const dispatch = createEventDispatcher()
  import _ from 'lodash'
  import {PrimaryButton} from '../../@components/buttons'

  import Container from './ComponentContainer.svelte'
  import {MODAL_TYPES} from '../../const'
  import { wrapInStyleTags, getUniqueId, createInstance } from '../../utils'

  import {modal,editorViewDev,userRole} from '../../@stores/app'
  import symbols from '../../@stores/data/site/symbols'
  import {content} from '../../@stores/data/page'

  export let button;

  let componentBeingEdited = null
  function editSymbol(component) {
    modal.show(
      'COMPONENT_EDITOR', 
      {
        component,
        button: {
          label: `Save ${component.title || 'Symbol'}`,
          onclick: async (symbol) => {
            modal.show('COMPONENT_LIBRARY', {button})
            await Promise.all([
              symbols.place(symbol),
              content.updateInstances(symbol),
              // updateInstancesInDomain(symbol), // TODO
            ])
            site.save({ symbols: $symbols })
          }
        }
      }, 
      { 
        header: {
          title: `Edit ${component.title || 'Symbol'}`,
          icon: 'fas fa-clone'
        } 
      }
    )
  }

  async function addSymbol() {
    const symbol = {
      type: 'component',
      id: getUniqueId(),
      value: {
        raw: {
          css: '',
          html: '',
          js: '',
          fields: []
        },
        final: {
          css: '',
          html: '',
          js: '',
        }
      }
    }
    editSymbol(symbol)
  }

  async function deleteSymbol(symbol) {
    symbols.remove(symbol.id)
  }

  function addComponentToPage(symbol) {
    const instance = createInstance(symbol)
    button.onclick(instance)
  }

  function getID(symbol) {
    return symbol.id+symbol.value.final.html+symbol.value.final.css
  }

  function updateSymbol(symbol, value) {
    symbols.place({
      ...symbol,
      ...value
    })
    site.save({ symbols: $symbols })
  }

</script>

{#if $editorViewDev}
  <PrimaryButton on:click={addSymbol} variants="mb-4">
    <i class="fas fa-plus mr-1"></i>
    <span>Create New Symbol</span>
  </PrimaryButton>
{:else if $symbols.length === 0}
  <p class="p-48 text-center">
    {#if $userRole === 'developer'}
      This is where you can add components which you can reuse across your site (we call them Symbols). You'll need to be in Developer mode to make a Symbol.
    {:else}
      This is where your reusable components go (we call them Symbols), but you'll need the site developer to make some first.
    {/if}
  </p>
{/if}

{#each $symbols as symbol (getID(symbol))}
  <Container 
    on:update={({detail}) => updateSymbol(symbol, detail)}
    on:edit={() => editSymbol(symbol)}
    on:delete={() => deleteSymbol(symbol)}
    on:select={() => addComponentToPage(symbol)}
    component={symbol}
  />
{/each}