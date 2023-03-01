<script>
  import _ from 'lodash-es'
  import fileSaver from 'file-saver'
  import axios from 'axios'
  import { hoveredBlock } from '$lib/editor/stores/app/misc'
  import { symbols, pages } from '$lib/editor/stores/data/draft'
  import Icon from '@iconify/svelte'
  import { createUniqueID } from '$lib/editor/utilities'
  import { Symbol } from '$lib/editor/const'
  import Sidebar_Symbol from './Sidebar_Symbol.svelte'
  import {
    symbols as actions,
    deleteInstances,
  } from '$lib/editor/stores/actions'
  import { get_row } from '$lib/supabase'

  let active_tab = 'site'

  function createInstance(symbol) {
    const instanceID = createUniqueID()
    return {
      type: 'component',
      id: instanceID,
      symbolID: symbol.id,
    }
  }

  async function createSymbol() {
    const symbol = Symbol()
    placeSymbol(symbol)
  }

  async function placeSymbol(symbol) {
    const exists = _.some($symbols, ['id', symbol.id])
    if (exists) {
      actions.update(symbol)
    } else {
      actions.create(symbol)
    }
  }

  async function deleteSymbol(symbol) {
    await deleteInstances(symbol)
    actions.delete(symbol)
  }

  async function duplicateSymbol(symbol) {
    const new_symbol = _.cloneDeep(symbol)
    new_symbol.id = createUniqueID()
    new_symbol.name = `${new_symbol.name} (copy)`
    placeSymbol(new_symbol)
  }

  async function uploadSymbol({ target }) {
    var reader = new window.FileReader()
    reader.onload = async function ({ target }) {
      if (typeof target.result !== 'string') return
      const uploaded = JSON.parse(target.result)
      placeSymbol({
        ...uploaded,
        id: createUniqueID(),
        type: 'symbol',
      })
    }
    reader.readAsText(target.files[0])
  }

  async function downloadSymbol(symbol) {
    const copied_symbol = _.cloneDeep(symbol)
    delete copied_symbol.type
    const json = JSON.stringify(copied_symbol)
    var blob = new Blob([json], { type: 'application/json' })
    fileSaver.saveAs(blob, `${copied_symbol.name || copied_symbol.id}.json`)
  }

  async function get_primo_block() {
    // const { data: breezly_blocks, error } = await get_row(
    //   'emails',
    //   '0e2c6a9f-0225-4a68-9e2f-ea105fc60a23'
    // )

    const { data: symbols } = await axios.get(
      'https://api.primo.so/public-library'
    )
    console.log({ symbols })
    return symbols
    // if (error) {
    //   console.log(error)
    //   return []
    // } else {
    //   return breezly_blocks.symbols
    // }
  }

  function add_to_page(symbol) {
    if ($hoveredBlock.position === 'top') {
      $pages = $pages.map((page) => ({
        ...page,
        sections: [
          ...page.sections.slice(0, $hoveredBlock.i),
          createInstance(symbol),
          ...page.sections.slice($hoveredBlock.i),
        ],
      }))
    } else {
      $pages = $pages.map((page) => ({
        ...page,
        sections: [
          ...page.sections.slice(0, $hoveredBlock.i + 1),
          createInstance(symbol),
          ...page.sections.slice($hoveredBlock.i + 1),
        ],
      }))
    }
  }
</script>

<div class="sidebar primo-reset">
  <div class="tabs">
    <button
      on:click={() => (active_tab = 'site')}
      class:active={active_tab === 'site'}>Site Blocks</button
    >
    <button
      on:click={() => (active_tab = 'primo')}
      class:active={active_tab === 'primo'}>Primo Blocks</button
    >
  </div>
  {#if active_tab === 'site'}
    {#if $symbols.length > 0}
      <div class="buttons">
        <button class="button" on:click={createSymbol}>
          <Icon icon="mdi:plus" />
        </button>
        <label class="button">
          <input on:change={uploadSymbol} type="file" accept=".json" />
          <Icon icon="mdi:upload" />
        </label>
      </div>
      <div class="symbols">
        {#each $symbols as symbol (symbol.id)}
          <Sidebar_Symbol
            {symbol}
            on:edit={({ detail: updated_symbol }) =>
              placeSymbol(updated_symbol)}
            on:download={() => downloadSymbol(symbol)}
            on:delete={() => deleteSymbol(symbol)}
            on:duplicate={() => duplicateSymbol(symbol)}
            on:add_to_page={() => add_to_page(symbol)}
          />
        {/each}
      </div>
    {:else}
      <div class="empty">
        <p>You don't have any blocks in your site yet</p>
        <p>
          Create a Block from scratch, upload an existing Block, or use the
          Breezly Blocks.
        </p>
      </div>
      <div class="buttons">
        <button class="button" on:click={createSymbol}>
          <Icon icon="mdi:plus" />
          <span>Create</span>
        </button>
        <label class="button">
          <input on:change={uploadSymbol} type="file" accept=".json" />
          <Icon icon="mdi:upload" />
          <span>Upload</span>
        </label>
      </div>
    {/if}
  {:else}
    <div class="symbols">
      {#await get_primo_block() then blocks}
        {#each blocks as symbol (symbol.id)}
          <Sidebar_Symbol
            {symbol}
            controls_enabled={false}
            on:edit={({ detail: updated_symbol }) =>
              placeSymbol(updated_symbol)}
            on:download={() => downloadSymbol(symbol)}
            on:delete={() => deleteSymbol(symbol)}
            on:duplicate={() => duplicateSymbol(symbol)}
            on:add_to_page={() => {
              placeSymbol(symbol)
              add_to_page(symbol)
            }}
          />
        {/each}
      {/await}
    </div>
  {/if}
</div>

<style lang="postcss">
  .sidebar {
    background: #fff;
    z-index: 9;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 52px);
    gap: 1rem;
    /* position: fixed; */
    /* margin-top: 52px; */
    /* width: 25vw; */
    /* overflow: scroll; */
    z-index: 9;
    position: relative;
    overflow-y: scroll;
  }

  .tabs {
    border-bottom: 1px solid #e3e4e8;
    padding-top: 1rem;
    padding-inline: 1.5rem;
    display: flex;
    gap: 1rem;
    position: sticky;
    top: 0;
    background: white;
    z-index: 1;

    button {
      color: #71788e;
      font-weight: 500;
      font-size: 14px;
      white-space: nowrap;
      border-bottom: 3px solid transparent;
      padding: 0.5rem 0;
      transition: 0.1s;

      &.active {
        color: #1d5ffc;
        border-bottom: 3px solid #1d5ffc;
      }
    }
  }

  .empty {
    padding-inline: 1.5rem;

    p {
      font-size: 0.875rem;
      padding-bottom: 0.25rem;
    }
  }

  .buttons {
    display: flex;
    gap: 0.75rem;
    padding-inline: 1.5rem;

    .button {
      padding: 6px;
      background: #ebecef;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      gap: 0.25rem;
      align-items: center;

      input {
        display: none;
      }
    }
  }

  .symbols {
    padding-inline: 1.5rem;
    gap: 1rem;
    display: grid;
    padding-bottom: 1.5rem;
    /* overflow: scroll; */
  }
</style>
