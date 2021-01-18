<script lang="ts">
  import _ from 'lodash'
  import {fade} from 'svelte/transition'
  import { onMount, createEventDispatcher } from 'svelte' 
  import {writable} from 'svelte/store'
  import {getUniqueId,wrapInStyleTags} from '../../utils'
  import {getStyles,appendHtml} from './pageUtils.js'
  import Section from './Layout/Section.svelte'
  import Column from './Layout/Column.svelte'
  import ContentNode from './Layout/ContentNode.svelte'
  import ComponentNode from './Layout/ComponentNode.svelte'
  import {focusedNode} from '../../stores/app'
  import {wrapper as siteWrapper} from '../../stores/data/draft'
  import {wrapper as pageWrapper} from '../../stores/app/activePage'
  const dispatch = createEventDispatcher()
  import {IconButton} from '../../components/misc'

  import {id} from '../../stores/app/activePage'
  import {pages} from '../../stores/data/draft'

  export let content

  import type {Row,Column as ColumnType,Section as SectionType} from './Layout/LayoutTypes'

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
        content = content.filter((s) => s.id !== section.id)
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
      deleteRow(id)
      dispatch('contentChanged')
    }
  }

  function getRowById(id:string): Row {
    const rows = _.flattenDeep(content.map(section => section.columns.map(column => column.rows)))
    return _.find(rows, ['id', id])
  }

  function checkIfOnlyChild(id:string): boolean {
    return content.map(section => {
      return section.columns.filter(column => {
        return _.some(column.rows, ['id', id])
      })[0]
    }).filter(i => i)[0]['rows']['length'] === 1 
  }

  function deleteRow(rowId, replaceWithEmptyContent = false) {
    if (replaceWithEmptyContent) {
      updateRow(rowId, ContentRow());
    } else {
      updateRow(rowId, null);
    }
  }

  function updateRow(rowId, updatedRow) {
    content = content.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        rows: column.rows
          .map((existingRow) => {
            if (existingRow.id === rowId) {
              return updatedRow === null
                ? updatedRow
                : { ...existingRow, ...updatedRow }; // allow row to be removed
            } else return existingRow;
          })
          .filter((r) => r),
      })),
    }))
  }

  function saveRow(row) {
    if (getRow(row.id)) {
      updateRow(row.id, row);
    } else {
      insertComponent(row);
    }
  }

  function getRow(id) {
    const rows = _.flattenDeep(
      content.map((section) => section.columns.map((column) => column.rows))
    );
    return _.find(rows, ["id", id]);
  }

  function insertComponent(component) {
    const focusedNodeId = get(focusedNode).id;

    if (focusedNodeId) {
      // a content node is selected on the page
      content = content.map((section) => ({
        ...section,
        columns: section.columns.map((column) => ({
          ...column,
          rows: _.some(column.rows, ["id", focusedNodeId]) // this column contains the selected node
            ? positionComponent(column.rows, component) // place the component within
            : column.rows,
        })),
      }))
    } else if (content.length > 0) {
      const lastSection = content.slice(-1)[0];
      const lastColumn = lastSection.columns.slice(-1)[0];
      content = content.map((section) =>
        section.id === lastSection.id
          ? {
              ...section,
              columns: section.columns.map((column) =>
                column.id === lastColumn.id
                  ? {
                      ...column,
                      rows: [...column.rows, component],
                    }
                  : column
              ),
            }
          : section
      )
    }

    function positionComponent(rows, newRow) {
      const selectedNodePosition = get(focusedNode).position;
      const selectedNodeSelection = get(focusedNode).selection;

      if (selectedNodePosition === 0) {
        // first row is selected
        if (selectedNodeSelection === 0) {
          // top of first row selected
          return [newRow, ...rows];
        } else {
          return [...rows.slice(0, 1), newRow, ...rows.slice(1)];
        }
      } else if (selectedNodePosition > 0) {
        // somewhere else in the list
        if (selectedNodeSelection === 0) {
          return [
            ...rows.slice(0, selectedNodePosition),
            newRow,
            ...rows.slice(selectedNodePosition),
          ];
        } else {
          return [
            ...rows.slice(0, selectedNodePosition + 1),
            newRow,
            ...rows.slice(selectedNodePosition + 1),
          ];
        }
      } else {
        console.error("Could not position new component");
      }
    }
  }

  function insertContentRow(componentId, componentIndex, position = "above") {
    content = content.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        rows: _.some(column.rows, ["id", componentId])
          ? positionContentNode(
              column.rows,
              ContentRow(),
              componentIndex,
              position
            )
          : column.rows,
      })),
    }))

    function positionContentNode(rows, newRow, index, position) {
      if (position === "above") {
        return [...rows.slice(0, index), newRow, ...rows.slice(index)];
      } else {
        return [...rows.slice(0, index + 1), newRow, ...rows.slice(index + 1)];
      }
    }
  }

  // Constructors
  function ContentRow() {
    return {
      id: getUniqueId(),
      type: "content",
      value: {
        html: "",
      },
    };
  }
</script>

<div class="primo-page" style="border-top: 56px solid black">
  {#each content as section, i (section.id)}
    <Section {section}>
      {#each section.columns as column, i (column.id)}
        <Column {column}>
          {#each column.rows as row, i (row.id)}
            {#if row.type === 'component'}
              <ComponentNode 
                {row}
                on:delete={() => {
                  deleteRow(row.id, checkIfOnlyChild(row.id))
                  dispatch('contentChanged')
                }}
                on:edit={() => dispatch('componentEditClick', row)}
                contentAbove={hasContentAbove(i, column.rows)}
                contentBelow={hasContentBelow(i, column.rows)}
                on:addContentAbove={() => {
                  insertContentRow(row.id, i, 'above')
                  dispatch('contentChanged')
                }}
                on:addContentBelow={() => {
                  insertContentRow(row.id, i, 'below')
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
                  saveRow({ id: row.id, value: {html} })
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
  {@html $pageWrapper.below.final}
  {@html $siteWrapper.below.final}
</div>
