import { writable, readable, derived, get } from 'svelte/store';
import _ from "lodash";
import ShortUniqueId from 'short-unique-id';
import {focusedNode} from '../../app'
import site from '../site'
import {DEFAULTS} from '../../../const'

let content = DEFAULTS.page.content
const store = writable(DEFAULTS.page.content);
store.subscribe(s => {
  content = s
})

export default {
  save: () => {
    site.saveCurrentPage({content})
  },
  refresh: async () => {
    // const data = await getPageData()
    console.log('TODO: refresh page content')
  },
  hydrateComponents: async () => {
    const hydratedContent = await hydrateAllComponents(content)
    store.set(hydratedContent)
    site.saveCurrentPage({ content: hydratedContent})
  },
  insertContentRow,
  saveRow: (row) => {
    if (getRow(row.id)) {
      updateRow(row.id, row)
    } else {
      insertComponent(row)
    }
  },
  deleteRow: (rowId, replaceWithEmptyContent = false) => {
    if (replaceWithEmptyContent) {
      updateRow(rowId, ContentRow())
    } else {
      updateRow(rowId, null)
    }
  },
  updateInstances: async (symbol) => {
    const newContent = await updateInstancesInContent(symbol, get(store))
    store.set(newContent)
  },
  insertSection,
  deleteSection: (sectionId) => {
    store.update(content => content.filter(section => section.id !== sectionId))
  },
  subscribe: store.subscribe,
  set: store.set
}

// Helpers
function getRow(id) {
  const rows = _.flattenDeep(get(store).map(section => section.columns.map(column => column.rows)))
  return _.find(rows, ['id', id])
}

function updateRow(rowId, updatedRow) {
  store.update(content => content.map(section => ({
    ...section,
    columns: section.columns.map(column => ({
      ...column,
      rows: column.rows.map(existingRow => {
        if (existingRow.id === rowId) {
          return updatedRow === null ? updatedRow : { ...existingRow, ...updatedRow } // allow row to be removed
        } else return existingRow
      }).filter(r => r)
    }))
  })))
}

function insertComponent(component) {
  const focusedNodeId = get(focusedNode).id

  if (focusedNodeId) { // a content node is selected on the page
    store.update(content => content.map(section => ({
      ...section,
      columns: section.columns.map(column => ({
        ...column,
        rows: _.some(column.rows, ['id', focusedNodeId])  // this column contains the selected node
              ? positionComponent(column.rows, component) // place the component within
              : column.rows
      }))
    })))
  } else if (content.length > 0) {
    const content = get(store)
    const lastSection = content.slice(-1)[0]
    const lastColumn = lastSection.columns.slice(-1)[0]
    store.update(content => content.map(section => section.id === lastSection.id ? ({
      ...section,
      columns: section.columns.map(column => column.id === lastColumn.id ? ({
        ...column,
        rows: [
          ...column.rows,
          component
        ]
      }) : column)
    }) : section))
  }


  function positionComponent(rows, newRow) {

    const selectedNodePosition = get(focusedNode).position
    const selectedNodeSelection = get(focusedNode).selection

    if (selectedNodePosition === 0) { // first row is selected
      if (selectedNodeSelection === 0) { // top of first row selected
        return [ 
          newRow,
        ...rows
        ]
      } else { 
        return [ 
          ...rows.slice(0, 1),
          newRow,
          ...rows.slice(1)
        ]
      }
    } else if (selectedNodePosition > 0) { // somewhere else in the list
      if (selectedNodeSelection === 0) { 
        return [ 
          ...rows.slice(0, selectedNodePosition),
          newRow,
          ...rows.slice(selectedNodePosition)
        ]
      } else { 
        return [ 
          ...rows.slice(0, selectedNodePosition+1),
          newRow,
          ...rows.slice(selectedNodePosition+1)
        ]
      }
    } else {
      console.error('Could not position new component')
    }
  }

}

function insertContentRow(componentId, componentIndex, position = 'above') {
  store.update(content => content.map(section => ({
    ...section,
    columns: section.columns.map(column => ({
      ...column,
      rows: _.some(column.rows, ['id', componentId]) 
            ? positionContentNode(column.rows, ContentRow(), componentIndex, position)
            : column.rows
    }))
  })))

  function positionContentNode(rows, newRow, index, position) {
    if (position === 'above') {
      return [ 
        ...rows.slice(0, index),
        newRow,
        ...rows.slice(index)
      ]
    } else {
      return [ 
        ...rows.slice(0, index+1),
        newRow,
        ...rows.slice(index+1)
      ]
    }
  }
}

function insertSection(section, position) {
  const focusedSection = get(focusedNode).path.section
  const newSection = Section({
    width: section.fullwidth ? 'fullwidth' : 'contained',
    columns: section.columns.map(c => ({
      id: getUniqueId(),
      size: c,
      rows: [ ContentRow() ]
    }))
  })

  if (!focusedSection) {
    store.update(content => [ ...content, newSection ])
  } else {
    const content = get(store)
    const indexOfFocusedSection = _.findIndex(content, ['id', focusedSection.id])
    const contentWithNewSection = [ 
      ...content.slice(0, indexOfFocusedSection+1),
      newSection,
      ...content.slice(indexOfFocusedSection+1)
    ]
    store.set(contentWithNewSection)
  } 

}

async function hydrateAllComponents(content) {
  return await Promise.all(
    content.map(async section => ({
      ...section,
      columns: await Promise.all(
        section.columns.map(async column => ({
        ...column,
        rows: await Promise.all(
          column.rows.map(async row => {
            if (row.type === 'content') return row
            else return hydrateComponent(row)
          })
        )
      })))
    }))
  )
}

async function updateInstancesInContent(symbol, content) {
  return Promise.all(content.map(async section => {
    return {
      ...section,
      columns: await Promise.all(section.columns.map(async column => {
          return {
            ...column,
            rows: await Promise.all(column.rows.map(async instance => { 
              if (instance.type !== 'component' || instance.symbolID !== symbol.id) return instance

              // Update instance from Symbol's HTML, CSS, and JS & Instance's data

              // Replace instance's fields with symbol's fields while preserving instance's data
              const symbolFields = _.cloneDeep(symbol.value.raw.fields)
              const instanceFields = instance.value.raw.fields
              const mergedFields = _.unionBy(symbolFields, instanceFields, "id");

              instanceFields.forEach(field => {
                let newFieldIndex = _.findIndex(mergedFields, ['id',field.id])
                mergedFields[newFieldIndex]['value'] = field.value
              })

              const allFields = getAllFields(instance)
              const data = await convertFieldsToData(allFields, 'all')

              const symbolRawHTML = symbol.value.raw.html
              const instanceFinalHTML = await parseHandlebars(symbolRawHTML, data)

              const symbolFinalCSS = symbol.value.final.css
              const instanceFinalCSS = symbolFinalCSS.replace(RegExp(`${symbol.id}`, 'g'),`${instance.id}`)

              return {
                ...instance,
                value: {
                  ...instance.value,
                  raw: {
                    ...instance.value.raw,
                    fields: mergedFields,
                    css: symbol.value.raw.css,
                    js: symbol.value.raw.js,
                    html: symbolRawHTML,
                  },
                  final: {
                    ...symbol.value.final,
                    css: instanceFinalCSS,
                    html: instanceFinalHTML,
                    js: symbol.value.final.js
                  }
                }
              }
            }))
          }
      }))
    }
  }))
}

function getUniqueId() {
  return new ShortUniqueId().randomUUID(5).toLowerCase();
}

// Constructors
function ContentRow() {
  return {
    id: getUniqueId(),
    type: 'content',
    value: {
      html: ''
    }
  }
}

const Section = (options = {}) => ({
  id: getUniqueId(),
  width: 'contained',
  columns: [{
    id: getUniqueId(),
    size: '',
    rows: [ ContentRow() ]
  }],
  ...options
})