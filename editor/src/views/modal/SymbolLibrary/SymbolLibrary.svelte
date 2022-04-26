<script context="module">
  import { writable } from 'svelte/store';
  const primoSymbols = writable([])
  const communitySymbols = writable([])
</script>

<script>
  import { _ as C } from 'svelte-i18n';
  import { onMount, getContext } from 'svelte';
  import {some as _some} from 'lodash-es';
  import fileSaver from 'file-saver'
  import axios from 'axios';
  import Masonry from '../../editor/Layout/ComponentPicker/Masonry.svelte';
  import Container from './SymbolContainer.svelte';
  import { Symbol } from '../../../const';
  import { createUniqueID } from '../../../utilities';
  import { userRole } from '../../../stores/app';
  import modal from '../../../stores/app/modal';
  import { symbols } from '../../../stores/data/draft';
  import Spinner from '../../../components/misc/Spinner.svelte'
  import {
    symbols as actions,
    deleteInstances,
  } from '../../../stores/actions';
  import ModalHeader from '../../modal/ModalHeader.svelte'
  const track = getContext('track')

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

  async function createSymbol() {
    const symbol = Symbol();
    editSymbol(symbol);
    track('CREATE_COMPONENT')
  }

  async function deleteSymbol(symbol) {
    await deleteInstances(symbol);
    actions.delete(symbol);
  }

  async function downloadSymbol(symbol) {
    delete symbol.type
    const json = JSON.stringify(symbol);
    var blob = new Blob([json], {type: "application/json"});
    fileSaver.saveAs(blob, `${symbol.name || symbol.id}.json`)
  }

  async function uploadSymbol({target}) {
    var reader = new window.FileReader()
    reader.onload = async function ({ target }) {
      if (typeof target.result !== 'string') return
      const uploaded = JSON.parse(target.result)
      placeSymbol({
        ...uploaded,
        id: createUniqueID(),
        type: 'symbol'
      });
    }
    reader.readAsText(target.files[0])
  }

  function copySymbolToSite(symbol) {
    placeSymbol({
      ...symbol,
      id: createUniqueID(),
    });
    if (selectedTab === 'primo') track('ADD_PRIMO_COMPONENT', { id: symbol.id })
    else if (selectedTab === 'community') track('ADD_COMMUNITY_COMPONENT', { id: symbol.id })
  }

  let symbolSubmission
  let contributor = ''
  let submitted = false
  async function submitSymbol() {
    const payload = {
      contributor,
      component: symbolSubmission
    }
    axios.post('https://api.primo.af/community-library.json', payload).then(res => {
      if (res.data?.ok) {
        submitted = true
      }
    })
  }

  function createInstance(symbol) {
    const instanceID = createUniqueID();
    return {
      type: 'component',
      id: instanceID,
      symbolID: symbol.id
    };
  }

  let [minColWidth, maxColWidth, gap] = [350, 800, 30];
  let width, height;

  let showingPublicLibrary = false;

  onMount(async () => {
    if ($primoSymbols.length === 0) {
      const { data: symbols } = await axios.get(
        'https://api.primo.af/public-library.json'
      );
      $primoSymbols = symbols || [];
    }
    if ($communitySymbols.length === 0) {
      const { data: symbols } = await axios.get(
        'https://api.primo.af/community-library.json'
      );
      $communitySymbols = symbols || [];
    }
  });

  let selectedTab = 'site'
</script>

<ModalHeader />
<main>
  <header class="tabs">
    <button on:click={() => selectedTab = 'site'} class:active={selectedTab === 'site'}>Site Library {$symbols.length > 1 ? `(${$symbols.length})` : ''}</button>
    <button on:click={() => selectedTab = 'primo'} class:active={selectedTab === 'primo'}>Primo Library</button>
    <button on:click={() => selectedTab = 'community'} class:active={selectedTab === 'community'}>Community Library</button>
  </header>
  {#if selectedTab === 'site'}
    <div class="xyz-in library-buttons">
      {#if $userRole === 'developer'}
        <button on:click={createSymbol} style="border-right:1px solid var(--color-gray-9)" id="create-symbol">
          <svg
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"><path
              fill-rule="evenodd"
              d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
              clip-rule="evenodd" /></svg>
          <span>{$C('Create')}</span>
        </button>
      {/if}
      <label class="button">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.7207 8.65351L7.76758 4.5957C7.89609 4.46719 8.10391 4.46719 8.23242 4.5957L12.2793 8.65351C12.4078 8.78203 12.4078 8.98984 12.2793 9.11836L11.7434 9.6543C11.6121 9.78555 11.4016 9.78281 11.2758 9.64883L8.71094 6.99375V13.7969C8.71094 13.9773 8.56328 14.125 8.38281 14.125H7.61719C7.43672 14.125 7.28906 13.9773 7.28906 13.7969V6.99375L4.72695 9.64883C4.59844 9.78008 4.38789 9.78281 4.25937 9.6543L3.72344 9.11836C3.59219 8.98984 3.59219 8.78203 3.7207 8.65351V8.65351ZM3.07812 3.29687H12.9219C13.1023 3.29687 13.25 3.14922 13.25 2.96875V2.20312C13.25 2.02266 13.1023 1.875 12.9219 1.875H3.07812C2.89766 1.875 2.75 2.02266 2.75 2.20312V2.96875C2.75 3.14922 2.89766 3.29687 3.07812 3.29687Z" fill="#E2E4E9"/>
        </svg>                              
        <span>{$C('Add')}</span>
        <input on:change={uploadSymbol} type="file" accept=".json">
      </label>
    </div>
    {#if $symbols.length === 0}
      <div id="empty-state">
        <span>
          {@html $C('no-components')}
        </span>
      </div>
    {/if}
  {:else if selectedTab === 'community'}
    <div class="contribution-form library-buttons xyz-in">
      {#if !submitted}
        <span>{@html $C('contribute-to-community-library')}</span>
        <div>
          <div>
            <span>{$C('Component')}</span>
            <select bind:value={symbolSubmission}>
              {#each $symbols.filter(s => s.name) as symbol}
                <option value={symbol}>{symbol.name}</option>
              {/each}
            </select>
          </div>
          <label>
            <!-- <span>{$C('Credit to (optional)')}</span> -->
            <input bind:value={contributor} type="text">
          </label>
          <button on:click={submitSymbol}>
            <span>{$C('Submit')}</span>
          </button>
        </div>
        <!-- <footer>
          Please only submit code which you wrote yourself
        </footer> -->
      {:else}
        <span>Thanks! Your contribution will be considered and posted publicly if accepted. Feel free to submit more.</span>
      {/if}
    </div>
  {/if}

  <Masonry
    items={({
      'site': $symbols,
      'primo': $primoSymbols,
      'community': $communitySymbols
    }[selectedTab])}
    {minColWidth}
    {maxColWidth}
    {gap}
    masonryWidth={10}
    animate={false}
    let:item
    bind:width
    bind:height>
    <Container
      titleEditable={selectedTab === 'site'}
      symbol={item}
      on:copy={() => downloadSymbol(item)}
      action={selectedTab !== 'site' ? {
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
      buttons={selectedTab === 'site' ? [
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
          onclick: () => downloadSymbol(item), 
          title: 'Copy Component', 
          svg: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.2793 7.34649L8.23242 11.4043C8.10391 11.5328 7.89609 11.5328 7.76758 11.4043L3.7207 7.34648C3.59219 7.21797 3.59219 7.01016 3.7207 6.88164L4.25664 6.3457C4.38789 6.21445 4.59844 6.21719 4.72422 6.35117L7.28906 9.00625L7.28906 2.20313C7.28906 2.02266 7.43672 1.875 7.61719 1.875L8.38281 1.875C8.56328 1.875 8.71094 2.02266 8.71094 2.20313L8.71094 9.00625L11.273 6.35117C11.4016 6.21992 11.6121 6.21719 11.7406 6.3457L12.2766 6.88164C12.4078 7.01016 12.4078 7.21797 12.2793 7.34649V7.34649ZM12.9219 12.7031L3.07813 12.7031C2.89766 12.7031 2.75 12.8508 2.75 13.0312L2.75 13.7969C2.75 13.9773 2.89766 14.125 3.07812 14.125L12.9219 14.125C13.1023 14.125 13.25 13.9773 13.25 13.7969L13.25 13.0313C13.25 12.8508 13.1023 12.7031 12.9219 12.7031Z" fill="#E2E4E9"/>
                </svg>` 
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
  {#if showingPublicLibrary && $primoSymbols.length === 0}
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

    button, label.button {
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

      input[type="file"] {
        display: none;
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

  .contribution-form {
    color: var(--color-gray-1);
    background: var(--color-gray-9);
    justify-self: flex-start;
    border-radius: var(--primo-border-radius);
    padding: 2rem;
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;

    & > div {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    label span {
      margin-right: 0.5rem;
    }

    input {
      padding: 0.5rem;
      background: var(--color-gray-8);
      border-radius: var(--primo-border-radius);

      &:focus {
        outline: 0;
      }
    }

    /* footer {
      color: var(--color-gray-4);
      font-size: 0.75rem;
    } */

    select {
      background: transparent;
      border: 1px solid var(--color-gray-1);
      border-radius: var(--primo-border-radius);
      padding: 0 0.5rem;
    }
  }

</style>
