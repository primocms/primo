<script>
  import { tick } from 'svelte'
  import _ from 'lodash-es'
  import fileSaver from 'file-saver'
  import axios from 'axios'
  import { hoveredBlock } from '$lib/editor/stores/app/misc'
  import site from '$lib/editor/stores/data/draft'
  import sections from '$lib/editor/stores/data/sections'
  import Icon from '@iconify/svelte'
  import { Symbol } from '$lib/editor/const'
  import Sidebar_Symbol from './Sidebar_Symbol.svelte'
  import {
    symbols as symbol_actions,
    active_page,
  } from '$lib/editor/stores/actions'
  import { v4 as uuidv4 } from 'uuid'
  import { validate_symbol } from '$lib/converter'
  import { page } from '$app/stores'

  let active_tab = 'site'

  async function createSymbol() {
    const symbol = Symbol()
    saveSymbol(symbol)
  }

  async function saveSymbol(symbol) {
    const exists = _.some($page.data.symbols, ['id', symbol.id])
    if (exists) {
      await symbol_actions.update({
        ...symbol,
        site: $site.id,
      })
    } else {
      return await symbol_actions.create({
        ...symbol,
        site: $site.id,
      })
    }
  }

  async function deleteSymbol(symbol) {
    symbol_actions.delete(symbol)
  }

  async function duplicateSymbol(symbol) {
    const new_symbol = _.cloneDeep(symbol)
    delete new_symbol.id
    delete new_symbol.created_at
    new_symbol.name = `${new_symbol.name} (copy)`
    saveSymbol(new_symbol)
  }

  async function uploadSymbol({ target }) {
    var reader = new window.FileReader()
    reader.onload = async function ({ target }) {
      if (typeof target.result !== 'string') return
      try {
        const uploaded = JSON.parse(target.result)
        const validated = validate_symbol(uploaded)
        saveSymbol({
          ...validated,
          id: uuidv4(),
        })
      } catch (error) {
        console.error(error)
      }
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
    return symbols.map((s) =>
      Symbol({
        name: s.name,
        fields: s.fields,
        content: s.content,
        code: s.code,
      })
    )
  }

  async function add_to_page(symbol) {
    // no existing sections, add as 0

    if ($hoveredBlock.id === null || $sections.length === 0) {
      // no blocks on page, add to top
      active_page.add_symbol(symbol, 0)
    } else if ($hoveredBlock.position === 'top') {
      active_page.add_symbol(symbol, $hoveredBlock.i)
    } else {
      active_page.add_symbol(symbol, $hoveredBlock.i + 1)
    }
  }
</script>

<div class="sidebar primo-reset">
  <div class="tabs">
    <button
      on:click={() => (active_tab = 'site')}
      class:active={active_tab === 'site'}
    >
      Site Blocks
    </button>
    <button
      on:click={() => (active_tab = 'primo')}
      class:active={active_tab === 'primo'}
    >
      Primo Blocks
    </button>
  </div>
  {#if active_tab === 'site'}
    {#if $page.data.symbols.length > 0}
      <div class="primo-buttons">
        <button class="primo-button" on:click={createSymbol}>
          <Icon icon="mdi:plus" />
        </button>
        <label class="primo-button">
          <input on:change={uploadSymbol} type="file" accept=".json" />
          <Icon icon="mdi:upload" />
        </label>
      </div>
      <div class="symbols">
        {#each $page.data.symbols as symbol (symbol.id)}
          <Sidebar_Symbol
            {symbol}
            on:edit_code={({ detail: updated_symbol }) =>
              saveSymbol(updated_symbol)}
            on:edit_content={({ detail: updated_symbol }) =>
              saveSymbol(updated_symbol)}
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
      <div class="primo-buttons">
        <button class="primo-button" on:click={createSymbol}>
          <Icon icon="mdi:plus" />
          <span>Create</span>
        </button>
        <label class="primo-button">
          <input on:change={uploadSymbol} type="file" accept=".json" />
          <Icon icon="mdi:upload" />
          <span>Upload</span>
        </label>
      </div>
    {/if}
  {:else}
    <div class="symbols">
      {#await get_primo_blocks() then blocks}
        {#each blocks as symbol, i}
          <Sidebar_Symbol
            {symbol}
            controls_enabled={false}
            on:edit={({ detail: updated_symbol }) => saveSymbol(updated_symbol)}
            on:download={() => downloadSymbol(symbol)}
            on:delete={() => deleteSymbol(symbol)}
            on:duplicate={() => duplicateSymbol(symbol)}
            on:add_to_page={async () => {
              const symbol_id = await saveSymbol(symbol)
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
    width: 100%;
    background: #171717;
    z-index: 9;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 54px);
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
    background: #171717;
    border-bottom: 1px solid #292929;
    padding-top: 1rem;
    padding-inline: 1.5rem;
    display: flex;
    gap: 1rem;
    position: sticky;
    top: 0;
    z-index: 1;

    button {
      color: #71788e;
      font-weight: 400;
      font-size: 14px;
      white-space: nowrap;
      border-bottom: 3px solid transparent;
      padding: 0.5rem 0;
      transition: 0.1s;

      &.active {
        color: #dadada;
        border-bottom: 2px solid var(--primo-color-brand);
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

  .primo-buttons {
    display: flex;
    gap: 0.5rem;
    padding-inline: 1.5rem;

    .primo-button {
      padding: 0.25rem 0.5rem;
      color: #b6b6b6;
      background: #292929;
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
