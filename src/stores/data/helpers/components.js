import _ from 'lodash'
import {get} from 'svelte/store'

export async function hydrateAllComponents(content) {
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

export async function hydrateComponent(component) {
  const {value} = component
  const fields = getAllFields(component.value.raw.fields)
  const data = await convertFieldsToData(fields, 'all')
  const finalHTML = await parseHandlebars(value.raw.html, data)
  component.value.final.html = finalHTML
  return component
}

export async function convertFieldsToData(fields, typeToUpdate = 'static') {
  let literalValueFields = fields
    .filter(f => f.type !== 'js')
    .map(f => ({
      key: f.key,
      value: f.type === 'number' ? parseInt(f.value) : f.value
    }))
    .reduce((obj, item) => (obj[item.key] = item.value, obj) ,{});

  var parsedFields = await Promise.all(
    fields.map(async (field) => {
      if (field.type === 'api' && (typeToUpdate === 'api' || typeToUpdate === 'all')) {
        let data
        try {
          let res = await axios.get(field.endpoint)
          data = res.data
        } catch(e) { console.error(e) }
        // const { data } = await axios.get(field.endpoint)
        const finalData = (typeof data === 'object' && field.endpointPath) ? objectPath.get(data, field.endpointPath || JSON.stringify(data)) : data
        field.value = finalData

        console.log({
          ['API Endpoint Accessed'] : field.endpoint,
          ['Endpoint Path'] : field.endpointPath,
          ['Raw data'] : data,
          ['Final result'] : finalData
        })

      } else if (field.type === 'js' && (typeToUpdate === 'js' || typeToUpdate === 'all')) {

        let data;

        try {
          data = Function('fields', field.code)(literalValueFields)
        } catch(e) {
          console.error(e)
        }

        literalValueFields = { 
          ...literalValueFields, 
          [field.key] : data
        }

        field.value = data;
      } else if (field.type === 'group') {
        if (field.fields) {
          field.value = _.chain(field.fields)
            .keyBy('key')
            .mapValues('value')
            .value();
        }
      }
      return field
    }
  ));

  return _.chain(parsedFields)
  .keyBy('key')
  .mapValues('value')
  .value();
}

let Handlebars
export async function parseHandlebars(code, data) {
  if (!Handlebars) {
    Handlebars = await import('handlebars/dist/handlebars.min.js')
  } 
  const template = Handlebars.compile(code);
  return template(data)
}

export async function updateInstancesInContent(symbol, content) {
  return Promise.all(content.map(async section => {
    return {
      ...section,
      columns: await Promise.all(section.columns.map(async column => {
          return {
            ...column,
            rows: await Promise.all(column.rows.map(async row => { 
              console.log({
                row,
                symbol
              })
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
  }))
}