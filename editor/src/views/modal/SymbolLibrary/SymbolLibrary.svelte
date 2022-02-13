<script context="module">
  import { writable } from 'svelte/store';
  const publicSymbols = writable([]);
</script>

<script>
  import { onMount } from 'svelte';
  import {some as _some} from 'lodash-es';
  import axios from 'axios';
  import Masonry from '../../editor/Layout/ComponentPicker/Masonry.svelte';
  import Container from './SymbolContainer.svelte';
  import { Symbol } from '../../../const';
  import { createUniqueID } from '../../../utilities';
  import {convertSymbols} from '../../../utils'
  import { userRole } from '../../../stores/app';
  import modal from '../../../stores/app/modal';
  import { symbols } from '../../../stores/data/draft';
  import Spinner from '../../../components/misc/Spinner.svelte'
  import {
    symbols as actions,
    deleteInstances,
  } from '../../../stores/actions';
  import ModalHeader from '../../modal/ModalHeader.svelte'

  export let onselect = null

  function editSymbol(symbol) {
    modal.show(
      'COMPONENT_EDITOR',
      {
        component: symbol,
        header: {
          title: `Edit ${symbol.title || 'Component'}`,
          icon: 'fas fa-clone',
          button: {
            label: `Draft Component`,
            icon: 'fas fa-check',
            onclick: (symbol) => {
              placeSymbol(symbol);
              modal.show('SYMBOL_LIBRARY');
            },
          },
        },
      }
    );
  }

  async function placeSymbol(symbol) {
    const exists = _some($symbols, ['id', symbol.id]);
    if (exists) {
      actions.update(symbol);
    } else {
      actions.create(symbol);
    }
  }

  async function addSymbol() {
    const symbol = Symbol();
    editSymbol(symbol);
  }

  async function deleteSymbol(symbol) {
    await deleteInstances(symbol);
    actions.delete(symbol);
  }

  let LZ;
  async function copySymbol(symbol) {
    if (!navigator.clipboard) {
      alert(
        'Unable to copy Symbol because your browser does not support copying'
      );
      return;
    }

    const currentlyCopied = await navigator.clipboard.readText();
    const copiedSymbols = parseCopiedSymbols(currentlyCopied);
    const symbolsToCopy = [...copiedSymbols, symbol];
    const jsonSymbols = JSON.stringify(symbolsToCopy);
    const compressedSymbols = LZ.compressToBase64(jsonSymbols);
    await navigator.clipboard.writeText(compressedSymbols);
  }

  async function pasteSymbol() {
    const compressedSymbols = await navigator.clipboard.readText();
    const symbols = parseCopiedSymbols(compressedSymbols);
    symbols.forEach((symbol) => {
      placeSymbol({
        ...symbol,
        id: createUniqueID(),
      });
    });
    await navigator.clipboard.writeText(``);
  }

  function copySymbolToSite(symbol) {
    placeSymbol({
      ...symbol,
      id: createUniqueID(),
    });
  }

  function parseCopiedSymbols(compressedSymbols) {
    try {
      const json = LZ.decompressFromBase64(compressedSymbols);
      const parsedSymbols = JSON.parse(json);
      if (Array.isArray(parsedSymbols)) {
        return parsedSymbols;
      } else {
        throw Error;
      }
    } catch (e) {
      return [];
    }
  }

  function createInstance(symbol) {
    const instanceID = createUniqueID();
    return {
      type: 'component',
      id: instanceID,
      symbolID: symbol.id
    };
  }

  onMount(async () => {
    if (!LZ) {
      LZ = (await import('lz-string')).default;
    }
  });

  let [minColWidth, maxColWidth, gap] = [350, 800, 30];
  let width, height;

  let showingPublicLibrary = false;

  onMount(async () => {
    let { data: symbols } = await axios.get(
      'https://api.primo.af/public-library.json'
    );
    symbols = convertSymbols(symbols)
    $publicSymbols = symbols || [];
  });

</script>

<ModalHeader />
<main>
  <header class="tabs">
    <button id ="site-library" on:click={() => showingPublicLibrary = false} class:active={!showingPublicLibrary}>Site Library {$symbols.length > 1 ? `(${$symbols.length})` : ''}</button>
    <button on:click={() => showingPublicLibrary = true} class:active={showingPublicLibrary}>Primo Library</button>
  </header>
  {#if !showingPublicLibrary}
    <div class="xyz-in library-buttons">
      {#if $userRole === 'developer'}
        <button on:click={addSymbol} style="border-right:1px solid var(--color-gray-9)" id="create-symbol">
          <svg
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"><path
              fill-rule="evenodd"
              d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
              clip-rule="evenodd" /></svg>
          <span>Create</span>
        </button>
      {/if}
      <button on:click={pasteSymbol} id="paste-symbol">
        <svg
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"><path
            d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          <path
            d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
        <span>Paste</span>
      </button>
    </div>
    {#if $symbols.length === 0}
      <div id="empty-state">
        <span>
          You don't have any Components in your Site Library. <br>You can develop Components from scratch, paste them in from another site, or add some from the Primo Library.
        </span>
      </div>
    {/if}
  {/if}
  <Masonry
    style="overflow:scroll"
    items={showingPublicLibrary ? $publicSymbols : $symbols}
    {minColWidth}
    {maxColWidth}
    {gap}
    masonryWidth={10}
    animate={false}
    let:item
    bind:width
    bind:height>
    <Container
      titleEditable={!showingPublicLibrary}
      symbol={item}
      on:copy={() => copySymbol(item)}
      action={showingPublicLibrary ? {
        onclick: () => copySymbolToSite(item), 
        title: 'Duplicate', 
        icon: 'fas fa-plus', 
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>`,
        label: 'Add to Site Library',
        clicked: {
          label: 'Added',
          icon: 'fas fa-check'
        }
      } : (onselect ? {
        onclick: () => onselect(createInstance(item)), 
        label: 'Add to Page', 
        icon: 'fas fa-plus', 
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>`
      } : null)}
      buttons={!showingPublicLibrary ? [
        { 
          onclick: () => {
            const confirm = window.confirm('This will delete ALL instances of this component across your site. Continue?');
            if (confirm) {
              deleteSymbol(item);
            }
          }, 
          title: 'Delete Component', 
          svg: `<svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>` 
        }, 
        { 
          id: 'copy', 
          onclick: () => copySymbol(item), 
          title: 'Copy Component', 
          svg: `<svg viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.14286 10.2857V11.1786C7.14286 11.4744 6.90301 11.7143 6.60714 11.7143H0.535714C0.239844 11.7143 0 11.4744 0 11.1786V2.96428C0 2.66841 0.239844 2.42856 0.535714 2.42856H2.14286V9.03571C2.14286 9.72497 2.70359 10.2857 3.39286 10.2857H7.14286ZM7.14286 2.60713V0.285706H3.39286C3.09699 0.285706 2.85714 0.525549 2.85714 0.82142V9.03571C2.85714 9.33158 3.09699 9.57142 3.39286 9.57142H9.46429C9.76016 9.57142 10 9.33158 10 9.03571V3.14285H7.67857C7.38393 3.14285 7.14286 2.90178 7.14286 2.60713ZM9.8431 1.91452L8.37118 0.442603C8.27072 0.342144 8.13446 0.285706 7.99239 0.285706L7.85714 0.285706V2.42856H10V2.29332C10 2.15124 9.94356 2.01499 9.8431 1.91452Z" fill="white"/>
                </svg>
                ` 
        }, 
        { 
          id: 'edit', 
          onclick: () => editSymbol(item), 
          title: 'Edit Component', 
          highlight: true, 
          svg: `<svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>` 
        }
      ] : []} />

  </Masonry>
  {#if showingPublicLibrary && $publicSymbols.length === 0}
    <div class="spinner-container">
      <Spinner />
    </div>
  {/if}
</main>

<style lang="postcss">

  main {
    background: var(--primo-color-black);
    padding: 1rem 3rem;
    overflow: scroll;
    display: grid;
    grid-template-rows: auto auto;
    gap: 1rem;
  }

  header.tabs {
    display: flex;
    gap: 2rem;
    border-bottom: 1px solid var(--color-gray-8);
    margin-bottom: 0.5rem;

    button {
      color: var(--primo-color-white);
      border-bottom: 2px solid transparent;
      transition: 0.1s solid border-color;
      padding-bottom: 0.25rem;

      span {
        color: var(--color-gray-5);
      }

      &.active {
        border-color: var(--primo-color-primored);
      }
    }
  }
  
  #empty-state {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: 1rem;
    height: 50vh;

    span {
      text-align: center;
      color: var(--color-gray-3);
      max-width: 30rem;
    }
  }

  .spinner-container {
    padding: 3rem;
    display: flex;
    justify-content: center;
  }

  .library-buttons {
    color: var(--color-gray-1);
    display: flex;
    gap: 0.5rem;
    padding-bottom: 1rem;

    button {
      background: var(--primo-color-codeblack);
      transition: var(--transition-colors);
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0.75rem 1.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;

      &:hover {
        background: transparent;
      }

      &:focus {
        outline: 0;
      }

      &:first-child {
        border-right: 1px solid var(--color-gray-9);
      }

      svg {
        width: 1rem;
        height: 1rem;
        margin-right: 5px;
      }
    }

    &:only-child {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-column: span 4 / span 4;

      button {
        padding: 1rem 0;
        font-size: var(--font-size-3);
        border: 0;
      }

      svg {
        width: 1.5rem;
        height: 1.5rem;
      }
    }
  }

</style>
