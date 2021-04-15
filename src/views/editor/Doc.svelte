<script lang="ts">
  import {find,unionBy} from 'lodash'
  import Block from './Layout/Block.svelte'
  import { pages, wrapper as siteWrapper, symbols, fields as siteFields } from '../../stores/data/draft'
  import { id, wrapper as pageWrapper, content, fields as pageFields } from '../../stores/app/activePage'
  import {getSymbol,getAllFields} from '../../stores/helpers'

  $: pageExists = findPage($id, $pages)
  function findPage(id, pages) {
    const [ root ] = id.split('/')
    const rootPage = find(pages, ['id', root])
    const childPage = rootPage ? find(rootPage?.pages, ['id', id]) : null
    return childPage || rootPage
  }

  function hydrateInstance(block, symbols, ...args) {
    const { fields } = block.value
    const symbol = find(symbols, ['id', block.symbolID])
    const instance = {
      ...block,
      value: {
        ...symbol.value,
        fields
      }
    }
    return instance
  }

</script>

<div class="primo-page" style="border-top: 56px solid rgb(20,20,20)">
  {#if pageExists}
    {#each $content as block, i (block.id)}
      {#if block.symbolID}
        <Block block={
          hydrateInstance(
            block,
            $symbols,
            $pageFields,
            $siteFields
          )} 
          {i} 
        />
      {:else}
        <Block {block} {i} />
      {/if}
    {/each}
  {/if}
  {@html $pageWrapper.below.final}
  {@html $siteWrapper.below.final}
</div>
