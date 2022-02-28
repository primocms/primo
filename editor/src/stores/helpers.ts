import {unionBy, find as _find, uniqBy, chain as _chain, flattenDeep as _flattenDeep} from 'lodash-es'
import _ from 'lodash-es'
import { get } from 'svelte/store'
import { site as activeSite, symbols, fields as siteFields } from './data/draft'
import activePage, { id, fields as pageFields, code as pageCode, sections } from './app/activePage'
import {locale} from './app/misc'
import { processCode, processCSS, getPlaceholderValue, getEmptyValue, LoremIpsum} from '../utils'
import type { Page as PageType, Site as SiteType, Symbol as SymbolType, Component as ComponentType, Field } from '../const'
import { Page } from '../const'

export function resetActivePage() {
  id.set('index')
  sections.set([])
  pageFields.set([])
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

export function getSymbol(symbolID): SymbolType {
  return _find(get(symbols), ['id', symbolID]);
}

export async function buildStaticPage({ page, site, locale = 'en', separateModules = false }: { page:PageType, site:SiteType, locale?:string, separateModules?:boolean }) {
  if (!page.sections) return null // ensure data fits current structure
  let [ head, below, ...blocks ] = await Promise.all([
    new Promise(async (resolve) => {
      const css:string = await processCSS(site.code.css + page.code.css)
      // TODO: fix
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
        data: getPageData({ page, site, loc: locale }),
        format: 'esm'});
      resolve(svelte)
    }),
    new Promise(async (resolve) => {
      const svelte = await processCode({ 
        code: {
          html: site.code.html?.below + page.code.html?.below, 
          css: '', 
          js: ''
        },
        data: getPageData({ page, site, loc: locale })
      });

      resolve(svelte) 
    }),
    ...page.sections.map(async section => {
      if (section.type === 'component') {

        const symbol = _find(site.symbols, ['id', section.symbolID])
        const componentHasContent = site.content[locale][page.id]?.[section.id]

        if (!componentHasContent) {
          console.log('COMPONENT DOES NOT HAVE CONTENT', section)
        }

        // if (!componentHasContent) return null // component has been placed but not filled out with content
        const data = getComponentData({
          component: section,
          page,
          site,
          loc: locale
        })

        const { html, css, js }: { html:string, css:string, js:string } = symbol.code

        const svelte = await processCode({ 
          code: {
            html, 
            css, 
            js 
          },
          data,
          format: 'esm',
          locale
        });

        return {
          ...svelte,
          type: 'component',
          symbol: symbol.id,
          id: section.id
        }

      } else if (section.type === 'content') {
        return {
          html: site.content[locale]?.[page.id]?.[section.id] || LoremIpsum(2),
          css: '',
          js: '',
          type: 'content',
          id: section.id
        }
      } 
    })
  ])

  blocks = blocks.filter(Boolean) // remove empty blocks

  // happens for empty blocks
  if (!blocks[0]) {
    return separateModules ? {
      html: null,
      modules: []
    } : '<div></div>'
  }

  const final = `
  <!DOCTYPE html>
  <html lang="${locale}">
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
      const html = block.html || site.content[locale]?.[page.id]?.[id] || ''
      return `
      ${css ? `<style>${css}</style>` : ``}
      <div class="primo-section has-${type}" id="${id}">
        <div class="primo-${type}">
          ${html}
        </div>
      </div>
    `
    }).join('')
  }

  function buildModules(blocks:any[]): string {
    return blocks.filter(block => block.js).map(block => {
      return separateModules ? 
        `<script type="module" async>
          import App from '/_modules/${block.symbol}.js';
          fetch('/${locale }.json').then(res => res.json()).then(data => {
            const content = {
              ...data,
              ...data['${page.id}'],
              ...data['${page.id}']['${block.id}']
            };
            console.log({content})
            new App({
              target: document.querySelector('#${block.id}'),
              hydrate: true,
              props: content
            });
          })
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

// Include page/site content alongside the component's content
export function getComponentData({
  component,
  page = get(activePage),
  site = get(activeSite),
  loc = get(locale),
  fallback = 'placeholder'
}: {
  component: ComponentType | SymbolType,
  page?: PageType,
  site?: SiteType,
  loc?: string,
  fallback?: 'placeholder' | 'empty'
}): object {
  const symbol = component.type === 'symbol' ? component : _find(site.symbols, ['id', component.symbolID])
  const componentData = _chain(symbol.fields)
    .map(field => {
      const content = site.content[loc][page.id]?.[component.id]?.[field.key]
      return {
        key: field.key,
        value: content !== undefined ? content : (fallback === 'placeholder' ? getPlaceholderValue(field) : getEmptyValue(field))
      }
    })
    .keyBy('key')
    .mapValues('value')
    .value();

  // remove pages from data object (not accessed from component)
  const pageIDs = _flattenDeep(site.pages.map(page => [ page.id, ...page.pages.map(p => p.id) ]))
  const siteContent = _chain(Object.entries(site.content[loc]).filter(([page]) => !pageIDs.includes(page))).map(([ page, sections ]) => ({ page, sections })).keyBy('page').mapValues('sections').value()

  return {
    ...siteContent,
    ...site.content[loc][page.id], // Page content (TODO: strip out section IDs, only include page keys)
    ...componentData
  }
}

export function getPageData({
  page = get(activePage),
  site = get(activeSite),
  loc = get(locale),
  fallback = 'placeholder'
}: {
  page?: PageType,
  site?: SiteType,
  loc?: string,
  fallback?: 'placeholder' | 'empty'
}): object {

  // TODO: hydrate page/site fields

  // remove pages from data object (not accessed from component)
  const pageIDs = _flattenDeep(site.pages.map(page => [ page.id, ...page.pages.map(p => p.id) ]))
  const siteContent = _chain(Object.entries(site.content[loc]).filter(([page]) => !pageIDs.includes(page))).map(([ page, sections ]) => ({ page, sections })).keyBy('page').mapValues('sections').value()

  // TODO: remove sections from page content (only keep field keys)

  return {
    ...siteContent,
    ...site.content[loc][page.id], // Page content
  }
}