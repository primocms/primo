<script context="module">
  import { writable } from 'svelte/store';
  const originalButton = writable(null);
  const publicSymbols = writable([]);

</script>

<script>
  import { onMount } from 'svelte';
  import _ from 'lodash';
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
    const exists = _.some($symbols, ['id', symbol.id]);
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

<ModalHeader icon="fas fa-clone" title="Components" variants="mb-2" />

<main>
  <Tabs {tabs} bind:activeTab />
  <Masonry
    items={activeTab === tabs[0] ? $symbols : $publicSymbols}
    {minColWidth}
    {maxColWidth}
    {gap}
    masonryWidth={10}
    animate={false}
    let:item
    bind:width
    bind:height>
    <Container
      symbol={item}
      buttons={[{ onclick: () => {
            dispatch('select', createInstance(item));
          }, highlight: true, label: 'Select', svg: `<svg style="height:1rem;width:1rem;" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path></svg>` }]} />
  </Masonry>
</main>

<style lang="postcss">
  main {
    background: var(--color-black);
    padding: 0.5rem;

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
    background: var(--color-codeblack);
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-radius: var(--border-radius-1);
    overflow: hidden;

    button {
      background: var(--color-codeblack);
      transition: var(--transition-colors);
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--color-gray-8);
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;

      &:hover {
        background: var(--color-primored);
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
