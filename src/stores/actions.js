import _ from 'lodash'
import {get} from 'svelte/store'
import {getAllFields} from './helpers'
import {convertFieldsToData, parseHandlebars, hydrateAllComponents, getUniqueId} from '../utils'
import {id,content} from './app/activePage'
import {focusedNode} from './app/editor'
import {pages, dependencies, styles, wrapper, fields, symbols} from './data/draft'

export async function hydrateSite(data) {
  pages.set(data.pages)
  dependencies.set(data.dependencies)
  styles.set(data.styles)
  wrapper.set(data.wrapper)
  fields.set(data.fields)
  symbols.set(data.symbols)
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

                    const allFields = getAllFields(row)
                    const data = await convertFieldsToData(allFields, 'all')

                    const symbolRawHTML = symbol.value.raw.html
                    const instanceFinalHTML = await parseHandlebars(symbolRawHTML, data)

                    const symbolFinalCSS = symbol.value.final.css
                    const instanceFinalCSS = symbolFinalCSS.replace(RegExp(`${symbol.id}`, 'g'),`${row.id}`)

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
                          js: symbol.value.final.js
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
      const updatedContent = await hydrateAllComponents(page.content);
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

export function insertSection(section, position) {
  const focusedSection = get(focusedNode).path.section;
  const newSection = createSection({
    width: section.fullwidth ? "fullwidth" : "contained",
    columns: section.columns.map((c) => ({
      id: getUniqueId(),
      size: c,
      rows: [createContentRow()],
    })),
  });

  if (!focusedSection) {
    // store.update((content) => [...content, newSection]);
    content.set([...content, newSection]);
  } else {
    const indexOfFocusedSection = _.findIndex(get(content), [
      "id",
      focusedSection.id,
    ]);
    const contentWithNewSection = [
      ...get(content).slice(0, indexOfFocusedSection + 1),
      newSection,
      ...get(content).slice(indexOfFocusedSection + 1),
    ];
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