<script context="module">
  import { writable } from 'svelte/store'
  const originalButton = writable(null)
  const publicSymbols = writable([])
</script>

<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import _ from 'lodash'
  import { Tabs } from '../../../components/misc'
  import axios from 'axios'

  import ModalHeader from '../ModalHeader.svelte'
  import Container from './SymbolContainer.svelte'
  import Spinner from '../../../components/misc/Spinner.svelte'
  import { createSymbol } from '../../../const'
  import { createUniqueID } from '../../../utilities'
  // import { sites } from '../../../../supabase/db'
  import { userRole } from '../../../stores/app'
  import libraries from '../../../stores/data/libraries'
  import modal from '../../../stores/app/modal'
  import { symbols } from '../../../stores/data/draft'
  import { symbols as actions, emancipateInstances } from '../../../stores/actions'

  export let button

  if (button) originalButton.set(button) // save the button originally passed in so it doesn't get lost when editing the symbol

  function editSymbol(symbol) {
    modal.show('COMPONENT_EDITOR', {
      component: symbol,
      header: {
        title: `Edit ${symbol.title || 'Component'}`,
        icon: 'fas fa-clone',
        button: {
          label: `Draft Component`,
          icon: 'fas fa-check',
          onclick: (symbol) => {
            placeSymbol(symbol)
            actions.update(symbol)
            modal.show('SYMBOL_LIBRARY')
          },
        },
      },
    }, {
      showSwitch: true
    })
  }

  async function placeSymbol(symbol) {
    const exists = _.some($symbols, ['id', symbol.id])
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
    await emancipateInstances(symbol)
    actions.delete(symbol)
  }

  function getID(symbol) {
    return symbol.id + symbol.value.html + symbol.value.css
  }

  function createInstance(symbol) {
    const instanceID = createUniqueID()
    return {
      type: 'component',
      id: instanceID,
      symbolID: symbol.id,
      value: {
        fields: symbol.value.fields
      },
    }
  }

  let LZ
  async function copySymbol(symbol) {
    if (!navigator.clipboard) {
      alert(
        'Unable to copy Symbol because your browser does not support copying'
      )
      return
    }

    const currentlyCopied = await navigator.clipboard.readText()
    const copiedSymbols = parseCopiedSymbols(currentlyCopied)
    const symbolsToCopy = [...copiedSymbols, symbol]
    const jsonSymbols = JSON.stringify(symbolsToCopy)
    const compressedSymbols = LZ.compressToBase64(jsonSymbols)
    await navigator.clipboard.writeText(compressedSymbols)
  }

  async function pasteSymbol() {
    const compressedSymbols = await navigator.clipboard.readText()
    const symbols = parseCopiedSymbols(compressedSymbols)
    symbols.forEach((symbol) => {
      placeSymbol({
        ...symbol,
        id: createUniqueID(),
      })
    })
    await navigator.clipboard.writeText(``)
  }

  function parseCopiedSymbols(compressedSymbols) {
    try {
      const json = LZ.decompressFromBase64(compressedSymbols)
      const parsedSymbols = JSON.parse(json)
      if (Array.isArray(parsedSymbols)) {
        return parsedSymbols
      } else {
        throw Error
      }
    } catch (e) {
      console.log(e)
      return []
    }
  }

  let mounted
  onMount(async () => {
    setTimeout(() => {
      mounted = true
    }, 3000)
    if (!LZ) {
      LZ = (await import('lz-string')).default
    }
  })

  const tabs = [
    {
      id: 'site',
      label: 'Site Library',
      icon: 'clone',
      highlighted: false
    },
    ...$libraries
  ]

  let activeTab = tabs[0]

  async function getSymbols() {
    window.plausible('Get Public Library')
    // const {data} = await sites.get({ path: 'mateo/public-library' })
    $publicSymbols = $libraries[0]['components']
  }

  $: if ($publicSymbols.length === 0 && activeTab === tabs[1]) {
    getSymbols()
  }

  let hovering = false
  $: tabs[0]['highlighted'] = hovering

</script>

<ModalHeader icon="fas fa-clone" title="Components" variants="mb-2" />

<Tabs {tabs} bind:activeTab variants="mt-2 mb-4" />

  <div class="mt-2">
    {#if activeTab === tabs[0]}
      <ul
        class="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
        xyz="fade stagger stagger-2"
      >
        <li
          class="xyz-in library-buttons text-gray-100 bg-codeblack grid grid-rows-2 rounded overflow-hidden"
        >
          {#if $userRole === 'developer'}
            <button
              on:click={addSymbol}
              class="py-2 border-b w-full flex justify-center items-center bg-codeblack hover:bg-primored focus:outline-none focus:border-2 border-gray-800 transition-colors duration-100"
            >
              <svg
                class="w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
                ><path
                  fill-rule="evenodd"
                  d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                /></svg
              >
              <span>Create</span>
            </button>
          {/if}
          <button
            on:click={pasteSymbol}
            class="py-2 w-full flex justify-center items-center bg-codeblack text-gray-100 hover:bg-primored focus:outline-none focus:border-2 border-gray-800 transition-colors duration-100"
          >
            <svg
              class="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              ><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path
                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
              /></svg
            >
            <span>Paste</span>
          </button>
        </li>
        {#each $symbols as symbol (getID(symbol))}
          <li class="xyz-in">
            <Container
              titleEditable
              {symbol}
              loadPreview={mounted}
              on:copy={() => copySymbol(symbol)}
              buttons={[
                {
                  onclick: () => {
                    const confirm = window.confirm('Are you sure you want to delete this component?')
                    if (confirm) {
                      deleteSymbol(symbol)
                    }
                  },
                  title: 'Delete Component',
                  svg: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>`,
                },
                {
                  id: 'copy',
                  onclick: () => copySymbol(symbol),
                  title: 'Copy Component',
                  svg: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"></path><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z"></path></svg>`,
                },
                {
                  id: 'edit',
                  onclick: () => editSymbol(symbol),
                  title: 'Edit Component',
                  focus: true,
                  svg: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>`,
                },
              ]}
            />
          </li>
        {/each}
      </ul>
    {:else}
      <ul
        class="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
        xyz="fade stagger stagger-2"
      >
      {#each $publicSymbols as symbol (getID(symbol))}
        <li class="xyz-in">
          <Container
            titleEditable={false}
            bind:hovering
            on:copy={() => {
              window.plausible('Copy Component', { props: { id: symbol.id } })
              copySymbol(symbol)
            }}
              buttons={[
                // {
                //   onclick: () => {
                //     const confirm = window.confirm('Are you sure you want to delete this component?')
                //     if (confirm) {
                //       deleteSymbol(symbol)
                //     }
                //   },
                //   label: 'Hide',
                //   title: `Hide this Component so you don't have to see it anymore`,
                //   svg: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                //           <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
                //           <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                //         </svg>`,
                // },
                { 
                  onclick: async () => {
                    await copySymbol(symbol)
                    await pasteSymbol()
                  },
                  highlight: true,
                  label: 'Add to Site',
                  focus: true,
                  clicked: {
                    label: `Added`,
                    svg: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                          </svg>`
                  },
                  svg: `
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
                  </svg>`,
                },
                // {
                //   id: 'copy',
                //   onclick: () => copySymbol(symbol),
                //   label: 'Copy',
                //   title: 'Copy this component to paste it into your site library or share it',
                //   focus: true,
                //   svg: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"></path><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z"></path></svg>`,
                // }
              ]}
            {symbol}
          />
        </li>
      {:else}
        <Spinner />
      {/each}
      </ul>
    {/if}
  </div>

<style>
  .library-buttons:only-child {
    @apply grid grid-cols-2 col-span-4 grid-rows-1;
  }
  .library-buttons:only-child button {
    @apply py-4 text-xl border-0 h-full;

    &:first-child {
      @apply border-r border-gray-800;
    }
  }
  .library-buttons:only-child svg {
    @apply w-6 h-6;
  }
</style>
