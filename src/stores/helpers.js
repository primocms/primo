import _ from 'lodash'
import {get} from 'svelte/store'
import {router} from 'tinro'
import { fields as siteFields, styles as siteStyles } from './data/draft'
import { fields as pageFields, styles as pageStyles, content } from './app/activePage'
import {getCombinedTailwindConfig} from './data/tailwind'
import {symbols} from './data/draft'
import components from './app/components'
import {wrapInStyleTags,convertFieldsToData} from '../utils'
import {processors} from '../component'

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

  function getActiveLink({value}) {
    const [currentPage] = get(router).path.split('/').slice(-1)
    return currentPage === value.url
  }
}

export function getSymbol(symbolID) {
   return _.find(get(symbols), ['id', symbolID]);
}

export function getTailwindConfig(asString = false) {
  const { tailwind:pageTW } = get(pageStyles)
  const { tailwind:siteTW } = get(siteStyles)
  const combined = getCombinedTailwindConfig(pageTW, siteTW)
  if (asString) {
    return combined
  }
  let asObj = {}
  try {
    asObj = new Function(`return ${combined}`)()
  } catch(e) {
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
        let component = block

        if (block.symbolID) {
          const symbol = site.symbols.filter(s => s.id === block.symbolID)[0]
          component = {
            ...symbol,
            id: component.id
          }
        } 

        const cacheKey = component.value.html + JSON.stringify(fields) // to avoid getting html cached with irrelevant data
        const [ html, css, js ] = await Promise.all([
          getSavedValue(cacheKey, processHTML),
          getSavedValue(component.value.css, processCSS),
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

export async function buildPagePreview({ page, site, separate = false }) {
  const content = await processContent(page, site)
  const tailwind = getTailwindConfig()
  if (separate) {
    const html = buildBlockHTML(content)
    const css = site.styles.final + page.styles.final
    const js = buildBlockJS(content)
    return { html, css, js, tailwind }
  } else {
    const parentStyles = wrapInStyleTags(site.styles.final) + wrapInStyleTags(page.styles.final)
    return parentStyles + buildBlockHTML(content, tailwind)
  }

  function buildBlockHTML(content, tailwind) {
    let html = "";
    for (let block of content) {
      if (block.type === 'component') {
        html += `
        <div class="block" id="block-${block.id}">
          <div class="primo-component" id="component-${block.id}">
            <div>${block.html}</div>
          </div>
        </div>
        <style type="text/css">${block.css}</style>
        `
      } else if (block.type === 'content') {
        html += `
          <div class="block" id="block-${block.id}">
            <div class="primo-copy" id="copy-${block.id}">
              ${block.value.html}
            </div>
          </div>
        `
      }
    }

    if (tailwind) {
      const twConfig = JSON.stringify({
        mode: 'silent',
        theme: tailwind.theme
      })

      html += `<script type="module" src="https://cdn.skypack.dev/twind/shim"></script>
      <script type="twind-config">
        ${twConfig}
      </script>`

      return `<html hidden class="primo-page">${html}</html>`;
    } else {
      return `<html class="primo-page">${html}</html>`
    }
  }

  function buildBlockJS(content) {
    return content.map(block => block.js).filter(Boolean)
  }
}

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
    ${value.js.replace(/(?:import )(\w+)(?: from )['"]{1}(?!http)(.+)['"]{1}/g,`import $1 from 'https://cdn.skypack.dev/$2'`)}`
  return finalJS
}