<script context="module">
  import { writable } from 'svelte/store';
  const originalButton = writable(null);
  const publicSymbols = writable([]);

</script>

<script>
  import { onMount } from 'svelte';
  import _some from 'lodash-es/some';
  import Masonry from '../../editor/Layout/ComponentPicker/Masonry.svelte';
  import { Tabs } from '../../../components/misc';
  import ModalHeader from '../ModalHeader.svelte';
  import Container from './SymbolContainer.svelte';
  import Spinner from '../../../components/misc/Spinner.svelte';
  import { createSymbol } from '../../../const';
  import { createUniqueID } from '../../../utilities';
  import { userRole } from '../../../stores/app';
  import libraries from '../../../stores/data/libraries';
  import modal from '../../../stores/app/modal';
  import { symbols } from '../../../stores/data/draft';
  import {
    symbols as actions,
    emancipateInstances,
  } from '../../../stores/actions';

  export let button;

  if (button) originalButton.set(button); // save the button originally passed in so it doesn't get lost when editing the symbol

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
              // actions.update(symbol)
              modal.show('SYMBOL_LIBRARY');
            },
          },
        },
      },
      {
        showSwitch: true,
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
    const symbol = createSymbol();
    editSymbol(symbol);
  }

  async function deleteSymbol(symbol) {
    await emancipateInstances(symbol);
    actions.delete(symbol);
  }

  function getID(symbol) {
    return symbol.id + symbol.value.html + symbol.value.css;
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
      console.log(e);
      return [];
    }
  }

  let mounted;
  onMount(async () => {
    setTimeout(() => {
      mounted = true;
    }, 3000);
    if (!LZ) {
      LZ = (await import('lz-string')).default;
    }
  });

  const tabs = [
    {
      id: 'site',
      label: 'Site Library',
      icon: 'clone',
      highlighted: false,
    },
    ...$libraries,
  ];

  let activeTab = tabs[0];

  async function getSymbols() {
    // window.plausible('Get Public Library');
    // const {data} = await sites.get({ path: 'mateo/public-library' })
    $publicSymbols = $libraries[0]['components'];
  }

  $: if ($publicSymbols.length === 0 && activeTab === tabs[1]) {
    getSymbols();
  }

  let hovering = false;
  $: tabs[0]['highlighted'] = hovering;

  let [minColWidth, maxColWidth, gap] = [300, 800, 20];
  let width, height;

</script>

<ModalHeader icon="fas fa-clone" title="Components" />

<main>
  <Tabs {tabs} bind:activeTab />
  <Masonry
    items={activeTab === tabs[0] ? [{ id: 'button' }, ...$symbols] : [{ id: 'button' }, ...$publicSymbols]}
    {minColWidth}
    {maxColWidth}
    {gap}
    masonryWidth={10}
    animate={false}
    let:item
    bind:width
    bind:height>
    <div>
      {#if item.value}
        <Container
          symbol={item}
          titleEditable={true}
          on:copy={() => copySymbol(item)}
          buttons={[{ onclick: () => {
                const confirm = window.confirm('Are you sure you want to delete this component?');
                if (confirm) {
                  deleteSymbol(item);
                }
              }, title: 'Delete Component', svg: `<svg style="width:1rem;height:1rem;" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>` }, { id: 'copy', onclick: () => copySymbol(item), title: 'Copy Component', svg: `<svg style="width:1rem;height:1rem;" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"></path><path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z"></path></svg>` }, { id: 'edit', onclick: () => editSymbol(item), title: 'Edit Component', highlight: true, svg: `<svg style="width:1rem;height:1rem;" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>` }]} />
      {:else}
        <div class="xyz-in library-buttons">
          {#if $userRole === 'developer'}
            <button on:click={addSymbol}>
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
          <button on:click={pasteSymbol}>
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
      {/if}
    </div>
  </Masonry>
</main>

<style lang="postcss">
  main {
    background: var(--primo-color-black);
    padding: 0 0.5rem 0.5rem 0.5rem;
    overflow: scroll;
    max-height: calc(100vh - 7rem);

    ul {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 15px;

      @media (max-width: 900px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }
  }
  .library-buttons {
    color: var(--color-gray-1);
    background: var(--primo-color-codeblack);
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-radius: var(--primo-border-radius);
    overflow: hidden;

    button {
      background: var(--primo-color-codeblack);
      transition: var(--transition-colors);
      padding: 3rem 0;
      border-bottom: 1px solid var(--color-gray-8);
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;

      &:hover {
        background: var(--primo-color-primored);
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
      grid-template-rows: 10rem;

      button {
        padding: 1rem 0;
        font-size: var(--font-size-3);
        border: 0;
        height: 100%;
      }

      svg {
        width: 1.5rem;
        height: 1.5rem;
      }
    }
  }

</style>
