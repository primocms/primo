import {unionBy, find, uniqBy, chain as _chain} from 'lodash-es'
import { get } from 'svelte/store'
import { fields as siteFields } from './data/draft'
import { id, fields as pageFields, code as pageCode, sections } from './app/activePage'
import { symbols } from './data/draft'
import { convertFieldsToData, processCode, processCSS, hydrateFieldsWithPlaceholders } from '../utils'
import {DEFAULTS} from '../const'
import type { Page as PageType, Site, Symbol } from '../const'
import { Page } from '../const'

export function resetActivePage() {
  id.set('index')
  sections.set([])
  pageFields.set([])
  // pageHTML.set(Page().code.html)
  // pageCSS.set(Page().code.css)
  pageCode.set(Page().code)
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
      const css:string = await processCSS(site.code.css + page.code.css)
      const fields:any[] = unionBy(page.fields, site.fields, "key")
      const data:object = convertFieldsToData(fields)
      const svelte:{ css:string, html:string, js:string } = await processCode({ 
        code: {
          html: `<svelte:head>
          ${site.code.html?.head}
          ${page.code.html?.head}
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
          html: site.code.html?.below + page.code.html?.below, 
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

        const pageData = site.content['en'][page.id]
        const data:object = pageData ? pageData[block.id] : _chain(hydrateFieldsWithPlaceholders(block.fields)).keyBy('key').mapValues('value').value();

        const { html, css, js }: { html:string, css:string, js:string } = symbol.code

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
      const { id, type, css } = block
      const html = block.html || site.content.en[page.id][id] || ''

      // if content type, attach module to replace html w/ downloaded replacement
      return `
      ${css ? `<style>${css}</style>` : ``}
      <div class="primo-section has-${type}" id="${id}">
        <div class="primo-${type}">
          ${html}
        </div>
      </div>
      ${
        type === 'content' ?
        `
        <script type="module" async>
          // import active language json, hydrate block
          const urlSearchParams = new URLSearchParams(window.location.search);
          const {lang = 'en'} = Object.fromEntries(urlSearchParams.entries());
          const file = '/' + lang + '.json'
          fetch(file).then(res => res.json()).then(content => {
            document.querySelector('#${id} > .primo-${type}').innerHTML = content['${page.id}']['${block.id}']
          })
        </script>
        ` : ''
      }
    `
    }).join('')
  }

  function buildModules(blocks:any[]): string {
    return blocks.filter(block => block.js).map(block => {
      const { id } = block
      return separateModules ? 
        `<script type="module" async>
          import App from './_modules/${block.symbol}.js';
          const urlSearchParams = new URLSearchParams(window.location.search);
          const {lang = 'en'} = Object.fromEntries(urlSearchParams.entries());
          const file = '/' + lang + '.json'
          fetch(file).then(res => res.json()).then(content => {
            new App({
              target: document.querySelector('#${block.id}'),
              hydrate: true,
              props: content['${page.id}']['${block.id}']
            });
          })
          // fetch primo.json, extract language json, pass into app, listen to localstorage changes for locale change
        </script>`
      : `<script type="module" async>
            const App = ${block.js};
            new App({
              target: document.querySelector('#${block.id}'),
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