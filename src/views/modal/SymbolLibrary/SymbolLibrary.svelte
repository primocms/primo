<script context="module">
  import { writable } from 'svelte/store'
  const originalButton = writable(null)
</script>

<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  const dispatch = createEventDispatcher()
  import _ from 'lodash'
  import {PrimaryButton} from '../../../components/buttons'
  import {pop} from 'svelte-spa-router'

  import ModalHeader from '../ModalHeader.svelte'
  import Container from './SymbolContainer.svelte'
  import {createSymbol} from '../../../const'
  import { wrapInStyleTags, getUniqueId } from '../../../utils'

  import {switchEnabled,userRole} from '../../../stores/app'
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
    const exists = _.some($symbols, ['id',symbol.id])
    if (exists) {
      actions.update(symbol)
    } else {
      actions.create(symbol)
    }
  }

  async function addSymbol() {
    const symbol = createSymbol()
    editSymbol(symbol)
  }

  async function deleteSymbol(symbol) {
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

  let LZ
  async function copySymbol(symbol) {
    if (!navigator.clipboard) {
      alert('Unable to copy Symbol because your browser does not support copying');
      return
    }

    const currentlyCopied = await navigator.clipboard.readText()
    const copiedSymbols = parseCopiedSymbols(currentlyCopied)
    const symbolsToCopy = [ ...copiedSymbols, symbol ]

    const jsonSymbols = JSON.stringify(symbolsToCopy)
    const compressedSymbols = LZ.compressToBase64(jsonSymbols)
    await navigator.clipboard.writeText(compressedSymbols)
  };

  async function pasteSymbol() {
    const compressedSymbols = await navigator.clipboard.readText()
    const symbols = parseCopiedSymbols(compressedSymbols)
    symbols.forEach(symbol => {
      placeSymbol(symbol)
    })
  }

  function parseCopiedSymbols(compressedSymbols) {
    try {
      const json = LZ.decompressFromBase64(compressedSymbols)
      const symbols = JSON.parse(json)
      if (Array.isArray(symbols)) {
        return symbols
      } else {
        throw Error
      }
    } catch(e) {
      console.error(e)
      return []
    }
  }

  onMount(async () => {
    if (!LZ) {
      LZ = (await import('lz-string')).default
    } 
  })

</script>

<ModalHeader 
  icon="fas fa-clone"
  title="Symbol Library"
  variants="mb-4"
/>

<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
  <div class="text-white bg-primored flex flex-col rounded overflow-hidden">
    {#if $userRole === 'developer'}
      <button on:click={addSymbol} class="border-b border-red-600 flex-1 flex justify-center items-center bg-red-600 hover:bg-red-700 transition-colors duration-100">
        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>      
        <span>Create</span>
      </button>
    {/if}
    <button on:click={pasteSymbol} class="flex-1 flex justify-center items-center bg-red-600 hover:bg-red-700 transition-colors duration-100">
      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path></svg>
      <span>Paste</span>
    </button>
  </div>
  {#each $symbols as symbol (getID(symbol))}
    <Container
      on:copy={() => copySymbol(symbol)}
      on:update={({detail}) => updateSymbol(symbol, detail)}
      on:edit={() => editSymbol(symbol)}
      on:delete={() => deleteSymbol(symbol)}
      on:select={() => addComponentToPage(symbol)}
      {symbol}
    />
  {/each}
</div>


<style>
  .buttons {
    grid-template-columns: 3fr 1fr;
  }
</style>