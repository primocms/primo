import _ from 'lodash'
import {get} from 'svelte/store'
import {getAllFields} from './helpers'
import {convertFieldsToData, parseHandlebars} from '../utils'
import {id,content} from './app/activePage'
import {pages} from './data/draft'

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