import { unionBy, find as _find, chain as _chain, flattenDeep as _flattenDeep } from 'lodash-es'
import _ from 'lodash-es'
import { get } from 'svelte/store'
import { processors } from '../component.js'
import { pages, site as activeSite, symbols, fields as siteFields } from './data/draft'
import activePage, { id, fields as pageFields, code as pageCode, sections } from './app/activePage'
import { locale } from './app/misc'
import { processCSS, getPlaceholderValue, getEmptyValue } from '../utils'
import type { Page as PageType, Site as SiteType, Symbol as SymbolType, Component as ComponentType, Field } from '../const'
import { Page } from '../const'

export function resetActivePage() {
  id.set('index')
  sections.set([])
  pageFields.set([])
  pageCode.set(Page().code)
}

export function getSymbolUseInfo(symbolID) {
  const info = { pages: [], frequency: 0 }
  get(pages).forEach(page => {
    page.sections.forEach(section => {
      if (section.symbolID === symbolID) {
        info.frequency++
        if (!info.pages.includes(page.id)) info.pages.push(page.name)
      }
    })
  })
  return info
}

export function getAllFields(componentFields: any[] = [], exclude = () => true) {
  return unionBy(componentFields, get(pageFields).filter(exclude), get(siteFields), "key").filter(exclude);
}

export function getSymbol(symbolID): SymbolType {
  return _find(get(symbols), ['id', symbolID]);
}

export async function buildStaticPage({ page, site, locale = 'en', separateModules = false }: { page: PageType, site: SiteType, locale?: string, separateModules?: boolean }) {
  const component = await Promise.all([
    (async () => {
      const css: string = await processCSS(site.code.css + page.code.css)
      const data = getPageData({ page, site, loc: locale })
      return {
        html: `
          <svelte:head>
            ${site.code.html.head}
            ${page.code.html.head}
            <style>${css}</style>
          </svelte:head>`,
        css: ``,
        js: ``,
        data
      }
    })(),
    ...page.sections.map(async section => {
      if (section.type === 'component') {
        const symbol = _find(site.symbols, ['id', section.symbolID])
        const { html, css: postcss, js }: { html: string, css: string, js: string } = symbol.code
        const data = getComponentData({
          component: section,
          page,
          site,
          loc: locale
        })
        const { css, error } = await processors.css(postcss || '')
        return {
          html: `
            <div class="section has-component" id="${section.id}">
              <div class="component">
                ${html} 
              </div>
            </div>`,
          js,
          css,
          data
        }
      } else if (section.type === 'content') {
        const html = site.content[locale][page.id][section.id]
        const data = getPageData({ page, site, loc: locale })
        return {
          html: `
            <div class="section has-content" id="${section.id}">
              <div class="content">
                ${html} 
              </div>
            </div>`,
          js: '',
          css: '',
          data
        }
      }
    }),
    (async () => {
      const data = getPageData({ page, site, loc: locale })
      return {
        html: site.code.html.below + page.code.html.below,
        css: ``,
        js: ``,
        data
      }
    })()
  ])

  const res = await processors.html({
    component,
    locale
  })


  const final = `
  <!DOCTYPE html>
  <html lang="${locale}">
    <head>
      ${res.head}
      <style>${res.css}</style>
    </head>
    <body id="page">
      ${res.html}
      <script type="module">${buildModule(res.js)}</script>
    </body>
  </html>
  `

  // fetch module & content to hydrate component
  function buildModule(js): string {
    return separateModules ? `\
      const [ {default:App}, data ] = await Promise.all([
        import('/_module.js'),
        fetch('/${locale}.json').then(res => res.json())
      ]).catch(e => console.error(e))
      new App({
        target: document.querySelector('body'),
        hydrate: true,
      })`
      :
      `\
    const App = ${js};
    new App({
      target: document.querySelector('body'),
      hydrate: true
    }); `
  }

  return separateModules ? {
    html: final,
    js: res.js
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
  const pageIDs = _flattenDeep(site.pages.map(page => [page.id, ...page.pages.map(p => p.id)]))
  const siteContent = _chain(Object.entries(site.content[loc]).filter(([page]) => !pageIDs.includes(page))).map(([page, sections]) => ({ page, sections })).keyBy('page').mapValues('sections').value()

  return {
    ...siteContent,
    ...site.content[loc][page.id], // Page content (TODO: strip out section IDs, only include page keys)
    ...componentData
  }
}

export function getPageData({
  page = get(activePage),
  site = get(activeSite),
  loc = get(locale)
}: {
  page?: PageType,
  site?: SiteType,
  loc?: string
}): object {

  // remove pages from data object (not accessed from component)
  const pageIDs = _flattenDeep(site.pages.map(page => [page.id, ...page.pages.map(p => p.id)]))
  const siteContent = _chain(Object.entries(site.content[loc]).filter(([page]) => !pageIDs.includes(page))).map(([page, sections]) => ({ page, sections })).keyBy('page').mapValues('sections').value()

  // TODO: remove sections from page content (only keep field keys)

  return {
    ...siteContent,
    ...site.content[loc][page.id], // Page content
  }
}