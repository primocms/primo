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
  title="Add Symbol"
  variants="mb-4"
/>

{#if $switchEnabled}
  <div class="buttons grid gap-2">
    <PrimaryButton on:click={addSymbol} variants="mb-4">
      <i class="fas fa-plus mr-1"></i>
      <span>Create New Symbol</span>
    </PrimaryButton>
    <PrimaryButton on:click={pasteSymbol} variants="mb-4">
      <i class="fas fa-paste mr-1"></i>
      <span>Paste Symbols</span>
    </PrimaryButton>
  </div>
{:else if $symbols.length === 0}
  <p class="p-48 text-center">
    {#if $userRole === 'developer'}
      This is where your reusable components go (we call them Symbols). You'll need to be in Developer mode to make a Symbol.
    {:else}
      This is where your reusable components go (we call them Symbols), but you'll need the site developer to make some first.
    {/if}
  </p>
{/if}

<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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