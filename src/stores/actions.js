import _ from 'lodash'
import {get} from 'svelte/store'
import {getAllFields} from './helpers'
import {convertFieldsToData, parseHandlebars, hydrateAllComponents, getUniqueId} from '../utils'
import {id,content} from './app/activePage'
import {focusedNode} from './app/editor'
import {pages, dependencies, styles, wrapper, fields} from './data/draft'
import * as stores from './data/draft'
import {timeline,undone} from './data/draft'
import {processors} from '../component'

export async function hydrateSite(data) {
  pages.set(data.pages)
  dependencies.set(data.dependencies)
  styles.set(data.styles)
  wrapper.set(data.wrapper)
  fields.set(data.fields)
  stores.symbols.set(data.symbols)
}

export async function updateInstances(symbol) {
  const updatedPages = await Promise.all(
    get(pages).map(async page => await ({
      ...page,
      content: await Promise.all(
        page.content.map(async section => {
          return {
            ...section,
            columns: await Promise.all(section.columns.map(async column => {
                return {
                  ...column,
                  rows: await Promise.all(column.rows.map(async row => { 
                    if (row.type !== 'component' || row.symbolID !== symbol.id) return row

                    // Update row from Symbol's HTML, CSS, and JS & Instance's data

                    // Replace row's fields with symbol's fields while preserving row's data
                    const symbolFields = _.cloneDeep(symbol.value.raw.fields)
                    const instanceFields = row.value.raw.fields
                    const mergedFields = _.unionBy(symbolFields, instanceFields, "id");

                    instanceFields.forEach(field => {
                      let newFieldIndex = _.findIndex(mergedFields, ['id',field.id])
                      mergedFields[newFieldIndex]['value'] = field.value
                    })

                    const allFields = getAllFields(row.value.raw.fields)
                    const data = await convertFieldsToData(allFields, 'all')

                    const symbolRawHTML = symbol.value.raw.html
                    const instanceFinalHTML = await processors.html(symbolRawHTML, { ...data, id: row.id })  // add instance ID 

                    const symbolFinalCSS = symbol.value.final.css
                    const instanceFinalCSS = symbolFinalCSS.replace(RegExp(symbol.id, 'g'),row.id)

                    const jsWithSkypack = symbol.value.raw.js.replace(/(?:import )(\w+)(?: from )['"]{1}(?!http)(.+)['"]{1}/g,`import $1 from 'https://cdn.skypack.dev/$2'`)
                    const jsWithNewID = jsWithSkypack.replace(RegExp(symbol.id, 'g'),row.id)
                    const instanceFinalJS = `\
                      const primo = {
                        id: '${row.id}',
                        data: ${JSON.stringify(data)},
                        fields: ${JSON.stringify(allFields)}
                      }
                    ${jsWithNewID}`

                    const updatedComponent = {
                      ...row,
                      value: {
                        ...row.value,
                        raw: {
                          ...row.value.raw,
                          fields: mergedFields,
                          css: symbol.value.raw.css,
                          js: symbol.value.raw.js,
                          html: symbolRawHTML,
                        },
                        final: {
                          ...symbol.value.final,
                          css: instanceFinalCSS,
                          html: instanceFinalHTML,
                          js: instanceFinalJS
                        }
                      }
                    }

                    return updatedComponent
                  }))
                }
            }))
          }
        })
      )
    }))
  )
  const activePageContent = _.find(updatedPages, ['id', get(id)])['content']
  content.set(activePageContent)
  pages.set(updatedPages)
}

export async function hydrateComponents() {
  const updatedPages = await Promise.all(
    get(pages).map(async (page) => {
      const updatedContent = await hydrateAllComponents(page.content, async (component) => {
        const allFields = getAllFields(component.value.raw.fields);
        const data = await convertFieldsToData(allFields, "all");
        const finalHTML = await parseHandlebars(component.value.raw.html, data);
        const updatedComponent = _.cloneDeep(component)
        updatedComponent.value.final.html = finalHTML
        return updatedComponent
      });
      return {
        ...page,
        content: updatedContent,
      };
    })
  );
  const activePageContent = _.find(updatedPages, ['id', get(id)])['content']
  content.set(activePageContent)
  pages.set(updatedPages)
}

export function insertSection(section) {
  const { id, position, selection, path } = get(focusedNode)
  const focusedSection = path.section
  const newSection = createSection({
    width: section.fullwidth ? "fullwidth" : "contained",
    columns: section.columns.map((c) => ({
      id: getUniqueId(),
      size: c,
      rows: [createContentRow()]
    })),
  });
  if (!focusedSection) {  // no section is focused
    content.set([...get(content), newSection]); // add it to the end
  } else {
    let contentWithNewSection 
    if (position === 0 && selection === 1) { // the first row in a section and first selection is focused
      contentWithNewSection = [ // add it to the top
        newSection, 
        ...get(content)
      ];
    } else {
      contentWithNewSection = [ // add it to the bottom
        ...get(content),
        newSection
      ];
    }
    content.set(contentWithNewSection);
  }

  function createSection(options = {}) {
    return {
      id: getUniqueId(),
      width: "contained",
      columns: [
        {
          id: getUniqueId(),
          size: "",
          rows: [createContentRow()],
        },
      ],
      ...options,
    }
  }

  function createContentRow() {
    return {
      id: getUniqueId(),
      type: "content",
      value: {
        html: "",
      },
    };
  }

}

export function undoSiteChange() {
  const state = get(timeline)

  // Set timeline back
  const timelineWithoutLastChange = state.slice(0, state.length - 1)
  timeline.set(timelineWithoutLastChange)

  // Save removed states
  undone.update(u => ([ ...state.slice(state.length - 1), ...u ]))

  // Set Site
  const siteWithoutLastChange = _.last(timelineWithoutLastChange)

  hydrateSite(siteWithoutLastChange)
}

export function redoSiteChange() {
  const restoredState = [ ...get(timeline), ...get(undone) ]
  timeline.set(restoredState)
  hydrateSite(restoredState[restoredState.length-1])
}

// experimenting with exporting objects to make things cleaner
export const symbols = {
  create: (symbol) => {
    stores.symbols.update(s => [ _.cloneDeep(symbol), ...s ])
  },
  update: (toUpdate) => {
    stores.symbols.update(symbols => {
      return symbols.map(s => s.id === toUpdate.id ? toUpdate : s)
    })
  },
  delete: (toDelete) => {
    stores.symbols.update(symbols => {
      return symbols.filter(s => s.id !== toDelete.id)
    })
  },
  hydrate: async () => {
    const existingSymbols = get(stores.symbols)
    console.log({existingSymbols})
    const updatedSymbols = await Promise.all(
      existingSymbols.map(async (symbol) => {
        const allFields = getAllFields(symbol.value.raw.fields);
        const data = await convertFieldsToData(allFields, "all");
        const finalHTML = await parseHandlebars(symbol.value.raw.html, data);
        const updatedSymbol = _.cloneDeep(symbol)
        updatedSymbol.value.final.html = finalHTML
        return updatedSymbol
      })
    );
    stores.symbols.set(updatedSymbols)
  }
}