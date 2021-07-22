import _ from 'lodash'
import { get } from 'svelte/store'
import { router } from 'tinro'
import { fields as siteFields, styles as siteStyles } from './data/draft'
import { fields as pageFields, styles as pageStyles, content } from './app/activePage'
import { getCombinedTailwindConfig } from './data/tailwind'
import { symbols, wrapper } from './data/draft'
import components from './app/components'
import { wrapInStyleTags, convertFieldsToData, processCode } from '../utils'
import { processors } from '../component'

export function getAllFields(componentFields = []) {
  const allFields = _.unionBy(componentFields, get(pageFields), get(siteFields), "key");
  const includeActiveLinks = allFields.map(hydrateField)
  return includeActiveLinks

  function hydrateField(field) {
    if (field.type === 'link') {
      return setLinkActive(field)
    } else if (field.type === 'repeater') {
      return field // TODO
    } else if (field.type === 'group') {
      return field // TODO
    } else return field
  }

  function setLinkActive(field) {
    const active = getActiveLink(field)
    return {
      ...field,
      value: {
        ...field.value,
        active
      }
    }
  }

  function getActiveLink({ value }) {
    const [currentPage] = get(router).path.split('/').slice(-1)
    return currentPage === value.url
  }
}

export function getSymbol(symbolID) {
  return _.find(get(symbols), ['id', symbolID]);
}

export function getTailwindConfig(asString = false) {
  const { tailwind: pageTW } = get(pageStyles)
  const { tailwind: siteTW } = get(siteStyles)
  const combined = getCombinedTailwindConfig(pageTW, siteTW)
  if (asString) {
    return combined
  }
  let asObj = {}
  try {
    asObj = new Function(`return ${combined}`)()
  } catch (e) {
    console.warn(e)
  }
  return asObj
}

export async function processContent(page, site) {
  const savedFinal = get(components)
  return await Promise.all(
    page.content.map(async block => {
      if (block.type === 'component') {

        const fields = _.unionBy(block.value.fields, page.fields, site.fields, "key");
        const data = convertFieldsToData(fields);
        let component = _.cloneDeep(block)

        if (block.symbolID) {
          const symbol = site.symbols.filter(s => s.id === block.symbolID)[0]
          component = {
            ...symbol,
            id: component.id
          }
        }

        const cacheKeys = {
          html: component.value.html + JSON.stringify(fields),
          css: component.id + component.value.css
        }

        const [html, css, js] = await Promise.all([
          getSavedValue(cacheKeys.html, processHTML),
          getSavedValue(cacheKeys.css, processCSS),
          getSavedValue(component.value.js, processJS),
        ])

        return ({
          type: 'component',
          id: block.id,
          html,
          css,
          js
        })

        async function getSavedValue(raw, fn) {
          const savedValue = savedFinal[raw]
          if (savedValue) return savedValue
          return await fn(component, { data, fields })
        }

      } else return block
    })
  )
}

export async function buildStaticPage({ page, site }) {
  const [ head, below, ...blocks ] = await Promise.all([
    new Promise(async (resolve) => {
      const fields = _.unionBy(page.fields, site.fields, "key");
      const data = convertFieldsToData(fields);
      const svelte = await processCode({ 
        html: `<svelte:head>
        ${site.html?.head}
        ${page.html?.head}
        <style>
        ${site.css}
        ${page.css}
        </style>
        </svelte:head>`, 
        css: '', 
        js: ''
      }, data, true);

      resolve(svelte)
    }),
    new Promise(async (resolve) => {
      const fields = _.unionBy(page.fields, site.fields, "key");
      const data = convertFieldsToData(fields);
      const svelte = await processCode({ 
        html: site.html?.below + page.html?.below, 
        css: '', 
        js: ''
      }, data, true);

      resolve(svelte) 
    }),
    ...page.content.map(async block => {
      if (block.type === 'component') {

        const fields = _.unionBy(block.value.fields, page.fields, site.fields, "key");
        const data = convertFieldsToData(fields);

        const symbol = site.symbols.filter(s => s.id === block.symbolID)[0]
        if (!symbol) return 
        const { html, css, js } = symbol.value

        const svelte = await processCode({ 
          html, 
          css, 
          js 
        }, data, true);

        return {
          ...svelte,
          type: 'component'
        }

      } else {
        const {html} = block.value
        const svelte = await processCode({ 
          html, 
          css: '', 
          js: '' 
        }, {}, true);
        return {
          ...svelte,
          type: 'content'
        }
      }
    })
  ])
  const final = `
  <html>
    <head>${head.html}</head>
    <body class="primo-page">
      ${blocks.map(block => `
        <div class="primo-block ${block.type === 'component' ? 'primo-component' : 'primo-content'}">
          ${block.html}
          ${block.css ? `<style>${block.css}</style>` : ``}
          ${block.js ? `<script>${block.js}</script>` : ``}
        </div>
      `).join('\n')}
      ${below.html}
    </body>
  </html>
  `
  return final
}


export async function buildPagePreview({ page, site }) {
  const res = await Promise.all([
    // new Promise(async (resolve) => {
    //   const fields = _.unionBy(page.fields, site.fields, "key");
    //   const data = convertFieldsToData(fields);
    //   const svelte = await processCode({ 
    //     html: `<svelte:head>
    //     ${site.html?.head}
    //     ${page.html?.head}
    //     <style>
    //     ${site.css}
    //     ${page.css}
    //     </style>
    //     </svelte:head>`, 
    //     css: '', 
    //     js: ''
    //   }, data, true);

    //   resolve({
    //     svelte
    //   })
    // }),
    ...page.content.map(async block => {
      if (block.type === 'component') {

        const fields = _.unionBy(block.value.fields, page.fields, site.fields, "key");
        const data = convertFieldsToData(fields);

        const symbol = site.symbols.filter(s => s.id === block.symbolID)[0]
        if (!symbol) return 
        const { html, css, js } = symbol.value

        const svelte = await processCode({ 
          html: `<svelte:head><style>${site.css}${page.css}</style></svelte:head>
          ${html}
          `, 
          css, 
          js 
        }, data, true);

        return svelte

      } else {
        const {html} = block.value
        // might add this back in later
        // const fields = _.unionBy(page.fields, site.fields, "key");
        // const data = convertFieldsToData(fields);
        const svelte = await processCode({ 
          html: `<svelte:head><style>${site.css}${page.css}</style></svelte:head>
          ${html}
          `, 
          css: '', 
          js: '' 
        }, {}, true);
        return svelte
      }
    }),
    // new Promise(async (resolve) => {
    //   const fields = _.unionBy(page.fields, site.fields, "key");
    //   const data = convertFieldsToData(fields);
    //   const svelte = await processCode({ 
    //     html: `<svelte:head><style>${site.css}${page.css}</style></svelte:head>
    //     ${site.html.below + page.html?.below}`, 
    //     css: site.css + page.css, 
    //     js: ''
    //   }, data, true);

    //   resolve({
    //     svelte
    //   }) 
    // })
  ])
  return res
}

// export async function buildPagePreview({ page, site }) {
//   return await Promise.all([
//     new Promise(async (resolve) => {
//       const fields = _.unionBy(page.fields, site.fields, "key");
//       const data = convertFieldsToData(fields);
//       const svelte = await processCode({ 
//         html: `<svelte:head>
//         ${site.html?.head}
//         ${page.html?.head}
//         <style>
//         ${site.css}
//         ${page.css}
//         </style>
//         </svelte:head>`, 
//         css: '', 
//         js: ''
//       }, data, true);

//       resolve({
//         svelte
//       })
//     }),
//     ...page.content.map(async block => {
//       if (block.type === 'component') {

//         const fields = _.unionBy(block.value.fields, page.fields, site.fields, "key");
//         const data = convertFieldsToData(fields);

//         const symbol = site.symbols.filter(s => s.id === block.symbolID)[0]
//         if (!symbol) return 
//         const { html, css, js } = symbol.value

//         const svelte = await processCode({ 
//           html: `<svelte:head><style>${site.css}${page.css}</style></svelte:head>
//           ${html}
//           `, 
//           css, 
//           js 
//         }, data);

//         return {
//           svelte
//         } 

//       } else {
//         const {html} = block.value
//         // might add this back in later
//         // const fields = _.unionBy(page.fields, site.fields, "key");
//         // const data = convertFieldsToData(fields);
//         const svelte = await processCode({ 
//           html: `<svelte:head><style>${site.css}${page.css}</style></svelte:head>
//           ${html}
//           `, 
//           css: '', 
//           js: '' 
//         }, {});
//         return {
//           svelte
//         }
//       }
//     }),
//     new Promise(async (resolve) => {
//       const fields = _.unionBy(page.fields, site.fields, "key");
//       const data = convertFieldsToData(fields);
//       const svelte = await processCode({ 
//         html: `<svelte:head><style>${site.css}${page.css}</style></svelte:head>
//         ${site.html.below + page.html?.below}`, 
//         css: site.css + page.css, 
//         js: ''
//       }, data);

//       resolve({
//         svelte
//       }) 
//     })
//   ])
// }

async function processHTML({ value }, { data }) {
  const final = await processors.html(value.html, data)
  components.update(c => ({
    ...c,
    [value.html]: final
  }))
  return final
}

async function processCSS({ id, value }) {
  if (!value.css) return ``
  const tailwind = getTailwindConfig(true)
  const encapsulatedCss = `#component-${id} {${value.css}}`;
  components.update(c => ({
    ...c,
    [`${id}-${value.css}`]: encapsulatedCss
  }))
  return processors.css(encapsulatedCss, { tailwind })
}

async function processJS({ id, value }, { data, fields }) {
  if (!value.js) return ''
  const finalJS = `
    const primo = {
      id: '${id}',
      data: ${JSON.stringify(data)},
      fields: ${JSON.stringify(fields)}
    }
    ${value.js.replace(/(?:import )(\w+)(?: from )['"]{1}(?!http)(.+)['"]{1}/g, `import $1 from 'https://cdn.skypack.dev/$2'`)}`
  return finalJS
}