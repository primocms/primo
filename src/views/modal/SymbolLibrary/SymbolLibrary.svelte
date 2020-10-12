<script context="module">
  import { writable } from 'svelte/store'
  const originalButton = writable(null)
</script>

<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  const dispatch = createEventDispatcher()
  import {some,cloneDeep} from 'lodash'
  import {PrimaryButton} from '../../../components/buttons'
  import {pop} from 'svelte-spa-router'

  import ModalHeader from '../ModalHeader.svelte'
  import Container from './ComponentContainer.svelte'
  import {createSymbol} from '../../../const'
  import { wrapInStyleTags, getUniqueId } from '../../../utils'

  import {editorViewDev,userRole} from '../../../stores/app'
  import modal from '../../../stores/app/modal'
  import {symbols} from '../../../stores/data/draft'
  import {content} from '../../../stores/app/activePage'
  import {updateInstances, symbols as actions } from '../../../stores/actions'

  export let button;
 
  if (button) originalButton.set(button) // save the button originally passed in so it doesn't get lost when editing the symbol

  let componentBeingEdited = null
  function editSymbol(symbol) {
    modal.show(
      'COMPONENT_EDITOR', 
      {
        component: symbol,
        header: {
          title: `Edit ${symbol.title || 'Symbol'}`,
          icon: 'fas fa-clone',
          button: {
            label: `Draft Symbol`,
            icon: 'fas fa-check',
            onclick: (symbol) => {
              placeSymbol(symbol)
              updateInstances(symbol)
              actions.update(symbol)
              pop()
            }
          }
        } 
      }
    )
  }

  async function placeSymbol(symbol) {
    const exists = some($symbols, ['id',symbol.id])
    if (exists) {
      // $symbols =  $symbols.map(s => s.id === symbol.id ? symbol : s)
      actions.update(symbol)
    } else {
      // $symbols = [ ...$symbols, symbol ]
      // addSymbolToLibrary(symbol)
      actions.create(symbol)
    }
  }

  async function addSymbol() {
    const symbol = createSymbol()
    editSymbol(symbol)
  }

  async function deleteSymbol(symbol) {
    // $symbols = $symbols.filter(s => s.id !== symbol.id)
    actions.delete(symbol)
  }

  function addComponentToPage(symbol) {
    const instance = createInstance(symbol)
    button ? button.onclick(instance) : $originalButton.onclick(instance)
  }

  function getID(symbol) {
    return symbol.id+symbol.value.final.html+symbol.value.final.css
  }

  function updateSymbol(symbol, value) {
    placeSymbol({
      ...symbol,
      ...value
    })
  }

  function createInstance(symbol) {
    const instanceID = getUniqueId()
    const instanceFinalCSS = symbol.value.final.css.replace(RegExp(`${symbol.id}`, 'g'),`${instanceID}`)
    return {
      type: 'component',
      id: instanceID,
      symbolID: symbol.id,
      value: {
        ...symbol.value,
        final: {
          ...symbol.value.final,
          css: instanceFinalCSS
        }
      }
    }
  }

</script>

<ModalHeader 
  icon="fas fa-clone"
  title="Add Symbol"
  variants="mb-4"
/>

{#if $editorViewDev}
  <PrimaryButton on:click={addSymbol} variants="mb-4">
    <i class="fas fa-plus mr-1"></i>
    <span>Create New Symbol</span>
  </PrimaryButton>
{:else if $symbols.length === 0}
  <p class="p-48 text-center">
    {#if $userRole === 'developer'}
      This is where your reusable components go (we call them Symbols). You'll need to be in Developer mode to make a Symbol.
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