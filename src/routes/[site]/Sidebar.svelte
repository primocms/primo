<script>
  import { tick } from 'svelte'
  import _ from 'lodash-es'
  import fileSaver from 'file-saver'
  import axios from 'axios'
  import { locale, hoveredBlock } from '$lib/editor/stores/app/misc'
  import site from '$lib/editor/stores/data/draft'
  import activePage, { sections } from '$lib/editor/stores/app/activePage'
  import Icon from '@iconify/svelte'
  import { createUniqueID } from '$lib/editor/utilities'
  import { Symbol } from '$lib/editor/const'
  import Sidebar_Symbol from './Sidebar_Symbol.svelte'
  import {
    symbols,
    pages,
    active_page,
    deleteInstances,
    updateContent,
  } from '$lib/editor/stores/actions'
  // import { pages } from '../../supabase/db'
  import { invalidate } from '$app/navigation'

  // export let data

  let active_tab = 'site'

  function createInstance(symbol) {
    return {
      symbol: symbol,
      content: symbol.content,
    }
  }

  async function createSymbol() {
    const symbol = Symbol()
    placeSymbol(symbol)
  }

  async function placeSymbol(symbol) {
    const exists = _.some($site.symbols, ['id', symbol.id])
    if (exists) {
      await symbols.update({
        ...symbol,
        site: $site.id,
      })
    } else {
      return await symbols.create({
        ...symbol,
        site: $site.id,
      })
    }
  }

  async function deleteSymbol(symbol) {
    // await deleteInstances(symbol)
    symbols.delete(symbol)
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

  async function get_primo_blocks() {
    const { data: symbols } = await axios.get(
      'https://api.primo.so/public-library'
    )
    return symbols.map((s) => ({
      name: s.name,
      fields: s.fields,
      content: s.content,
      code: s.code,
    }))
    // if (error) {
    //   console.log(error)
    //   return []
    // } else {
    //   return breezly_blocks.symbols
    // }
  }

  async function add_to_page(symbol) {
    console.log({ $hoveredBlock })
    if (!$hoveredBlock.i) {
      active_page.add_block(symbol, 0)
    } else if ($hoveredBlock.position === 'top') {
      active_page.add_block(symbol, $hoveredBlock.i)
      // pages.active_page.update({
      //   sections: [
      //     ...$sections.slice(0, $hoveredBlock.i),
      //     instance,
      //     ...$sections.slice($hoveredBlock.i),
      //   ],
      // })
    } else {
      active_page.add_block(symbol, $hoveredBlock.i + 1)
      // pages.active_page.update({
      //   sections: [
      //     ...$sections.slice(0, $hoveredBlock.i + 1),
      //     instance,
      //     ...$sections.slice($hoveredBlock.i + 1),
      //   ],
      // })
    }
    // invalidate('app:data')

    // if symbol has content, add it to the block content
    // if (symbol.content?.[$locale]) {
    //   const instance = createInstance(symbol)
    //   updateContent(instance, symbol.content[$locale]['en'])
    // }
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
    {#if $site.symbols.length > 0}
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
        {#each $site.symbols as symbol (symbol.id)}
          <Sidebar_Symbol
            {symbol}
            on:edit_code={({ detail: updated_symbol }) =>
              placeSymbol(updated_symbol)}
            on:edit_content={({ detail: updated_symbol }) =>
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
      {#await get_primo_blocks() then blocks}
        {#each blocks as symbol}
          <Sidebar_Symbol
            {symbol}
            controls_enabled={false}
            on:edit={({ detail: updated_symbol }) =>
              placeSymbol(updated_symbol)}
            on:download={() => downloadSymbol(symbol)}
            on:delete={() => deleteSymbol(symbol)}
            on:duplicate={() => duplicateSymbol(symbol)}
            on:add_to_page={async () => {
              const symbol_id = await placeSymbol(symbol)
              await tick()
              add_to_page({
                id: symbol_id,
                ...symbol,
              })
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
    height: calc(100vh - 84px);
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
