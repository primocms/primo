import {unionBy, find, uniqBy} from 'lodash-es'
import { get } from 'svelte/store'
import { fields as siteFields } from './data/draft'
import { id, fields as pageFields, css as pageCSS, html as pageHTML, sections } from './app/activePage'
import { symbols } from './data/draft'
import { convertFieldsToData, processCode, processCSS } from '../utils'
import {DEFAULTS} from '../const'
import type { Page, Site, Symbol } from '../const'

export function resetActivePage() {
  id.set('index')
  sections.set(DEFAULTS.page.sections)
  pageFields.set(DEFAULTS.fields)
  pageHTML.set(DEFAULTS.html)
  pageCSS.set(DEFAULTS.css)
}

export function getAllFields(componentFields:any[] = [], exclude = () => true) {
  const allFields: any[] = unionBy(componentFields, get(pageFields).filter(exclude), get(siteFields), "key").filter(exclude);
  const includeActiveLinks: any[] = allFields.map(hydrateField)
  return includeActiveLinks

  function hydrateField(field) {
    if (field.type === 'link') {
      return setLinkActive(field)
    } else if (field.type === 'repeater') {
      return {
        ...field,
        // value: field.value.map(item => {
        //   // TODO
        //   // loop through keys, 
        //   // check for url & active properties
        //   // const active = getActiveLink(item.link)
        //   return {
        //     ...item
        //   }
        // })
      } 
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
    // const [currentPage] = get(router).path.split('/').slice(-1) ##
    const currentPage = '' 
    return currentPage === value.url
  }
}

export function getSymbol(symbolID): Symbol {
  return find(get(symbols), ['id', symbolID]);
}

export async function buildStaticPage({ page, site, separateModules = false }: { page:Page, site:Site, separateModules:boolean }) {
  if (!page.sections) return null // ensure data fits current structure
  const [ head, below, ...blocks ] = await Promise.all([
    new Promise(async (resolve) => {
      const css:string = await processCSS(site.css + page.css)
      const fields:any[] = unionBy(page.fields, site.fields, "key")
      const data:object = convertFieldsToData(fields)
      const svelte:{ css:string, html:string, js:string } = await processCode({ 
        code: {
          html: `<svelte:head>
          ${site.html?.head}
          ${page.html?.head}
          <style>${css}</style>
          </svelte:head>
          `, 
          js: ''
        },
        data,
        format: 'esm'});
      resolve(svelte)
    }),
    new Promise(async (resolve) => {
      const fields = unionBy(page.fields, site.fields, "key");
      const data = convertFieldsToData(fields);
      const svelte = await processCode({ 
        code: {
          html: site.html?.below + page.html?.below, 
          css: '', 
          js: ''
        },
        data
      });

      resolve(svelte) 
    }),
    ...page.sections.map(async block => {
      if (block.type === 'component') {

        const symbol = site.symbols.filter(s => s.id === block.symbolID)[0]
        if (!symbol) return 

        // Remove fields no longer present in Symbol
        const symbolFields:any[] = symbol.value.fields
        const componentFields:any[] = block.value.fields.filter(field => find(symbolFields, ['id', field.id])) 
        const fields:any[] = unionBy(componentFields, page.fields, site.fields, "key");
        const data:object = convertFieldsToData(fields);

        const { html, css, js }: { html:string, css:string, js:string } = symbol.value

        const svelte = await processCode({ 
          code: {
            html, 
            css, 
            js 
          },
          data,
          format: 'esm'
        });

        return {
          ...svelte,
          type: 'component',
          symbol: symbol.id,
          id: block.id
        }

      } else if (block.type === 'content') {
        const {html} = block.value
        return {
          html,
          css: '',
          js: '',
          type: 'content',
          id: block.id
        }
      } 
    })
  ])

  // happens for empty blocks
  if (!blocks[0]) {
    return separateModules ? {
      html: null,
      modules: []
    } : '<div></div>'
  }

  const final = `
  <!DOCTYPE html>
  <html lang="en">
    <head>${head.html || ''}</head>
    <body class="primo-page">
      ${buildBlocks(blocks)}
      ${below.html || ''}
      ${buildModules(blocks)}
    </body>
  </html>
  `

  function buildBlocks(blocks:any[]): string {
    return blocks.map(block => {
      if (!block || block.type === 'options') return ''
      const { id, type } = block
      return `
        ${block.css ? `<style>${block.css}</style>` : ``}
        <div class="primo-section has-${type}" id="${id}">
          <div class="primo-${type}">
            ${block.html || ''}
          </div>
        </div>
      `
    }).join('')
  }

  function buildModules(blocks:any[]): string {
    return blocks.filter(block => block.js).map(block => {
      const { id } = block
      return separateModules ? 
        `<script type="module" async>
          import App from './_modules/${block.symbol}.js';
          new App({
            target: document.querySelector('#${id}'),
            hydrate: true
          });
        </script>`
      : `<script type="module" async>
            const App = ${block.js}
            new App({
              target: document.querySelector('#${id}'),
              hydrate: true
            });
        </script>`
    }).join('')
  }

  type Module = {
    symbol: string,
    content: string
  }

  const modules:Array<Module> = uniqBy(
    blocks.filter(block => block.js).map(block => ({
      symbol: block.symbol,
      content: block.js
    })), 'symbol'
  )

  return separateModules ? {
    html: final,
    modules
  } : final
}
