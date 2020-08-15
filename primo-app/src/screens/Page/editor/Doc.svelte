<script lang="ts">
  import _ from 'lodash'
  import {fade} from 'svelte/transition'
  import { onMount, createEventDispatcher } from 'svelte' 
  import {getUniqueId,wrapInStyleTags} from '../../../utils'
  import {getStyles,appendHtml} from '../pageUtils.js'
  import Section from './Layout/Section.svelte'
  import Column from './Layout/Column.svelte'
  import ContentNode from './Layout/ContentNode.svelte'
  import ComponentNode from './Layout/ComponentNode.svelte'
  import {focusedNode} from '../../../@stores/app'
  import {pageData,site} from '../../../@stores/data'
  import {content} from '../../../@stores/data/page'
  const dispatch = createEventDispatcher()
  import {IconButton} from '../../../@components/misc'

  import {Row,Column as ColumnType,Section as SectionType} from './Layout/LayoutTypes'

  function hasContentAbove(rowIndex: number, rows: Array<Row>): boolean {
    const rowAbove:Row = rows[rowIndex-1]
    if (rowAbove && rowAbove.type === 'content') {
      return true
    } else return false
  }

  function hasContentBelow(rowIndex:number, rows: Array<Row>): boolean {
    const rowBelow:Row = rows[rowIndex+1]
    if (rowBelow && rowBelow.type === 'content') {
      return true
    } else return false
  }

  function handleDeletion(): void {
    const {id,path} = $focusedNode
    if (id) {
      const { section, column } = path
      const sectionIsEmpty = determineIfSectionIsEmpty(section)
      const leftmostColumnSelected = (section.columns[0]['id'] === column.id)

      if (sectionIsEmpty && leftmostColumnSelected) {
        content.deleteSection(section.id)
        dispatch('contentChanged')
      } else {
        handleContentRowDeletion(id)
      }
    }
  }

  function determineIfSectionIsEmpty(section:SectionType): boolean {
    const dataInRows = _.flatMap(section.columns, column => column.rows.map(row => row.value))
    const dataInRowsEmpty = dataInRows.filter(row => row.html !== '<p><br></p>').length === 0
    return dataInRowsEmpty
  }

  function handleContentRowDeletion(id) {
    const isOnlyChild = checkIfOnlyChild(id)
    const isEmpty = getRowById(id)['value']['html'] === '<p><br></p>'
    if (!isOnlyChild && isEmpty && $focusedNode.focused) {
      content.deleteRow(id)
      dispatch('contentChanged')
    }
  }

  function getRowById(id:string): Row {
    const rows = _.flattenDeep($content.map(section => section.columns.map(column => column.rows)))
    return _.find(rows, ['id', id])
  }

  function checkIfOnlyChild(id:string): boolean {
    return $content.map(section => {
      return section.columns.filter(column => {
        return _.some(column.rows, ['id', id])
      })[0]
    }).filter(i => i)[0]['rows']['length'] === 1 
  }

</script>

<div class="primo-page" style="margin-top: 58px;">
  {@html $site.wrapper.final.above}
  {@html $pageData.wrapper.final.above}
  {#each $content as section, i (section.id)}
    <Section {section}>
      {#each section.columns as column, i (column.id)}
        <Column {column}>
          {#each column.rows as row, i (row.id)}
            {#if row.type === 'component'}
              <ComponentNode 
                {row}
                on:delete={() => {
                  content.deleteRow(row.id, checkIfOnlyChild(row.id))
                  dispatch('contentChanged')
                }}
                on:edit={() => dispatch('componentEditClick', row)}
                contentAbove={hasContentAbove(i, column.rows)}
                contentBelow={hasContentBelow(i, column.rows)}
                on:addContentAbove={() => {
                  content.insertContentRow(row.id, i, 'above')
                  dispatch('contentChanged')
                }}
                on:addContentBelow={() => {
                  content.insertContentRow(row.id, i, 'below')
                  dispatch('contentChanged')
                }}
              />
            {:else}
              <ContentNode 
                {row} 
                on:focus={({detail:selection}) => {
                  focusedNode.setSelection({
                    id: row.id,
                    position: i,
                    selection,
                    path: { section, column, row }
                  })
                }}
                on:change={({detail:html}) => {
                  content.saveRow({ id: row.id, value: {html} })
                  focusedNode.updatePath({ section, column, row })
                  dispatch('contentChanged')
                }}
                on:blur={() => {}}
                on:selectionChange={({detail:selection}) => {
                  focusedNode.setSelection({
                    id: row.id,
                    position: i,
                    selection,
                    path: { section, column, row }
                  })
                }}
                on:delete={() => {
                  handleDeletion()
                }}
              />
            {/if}
          {/each}
        </Column>
      {/each}
    </Section>
  {/each}
  {@html $pageData.wrapper.final.below}
  {@html $site.wrapper.final.below}
</div>
