import { unionBy, find as _find, chain as _chain, flattenDeep as _flattenDeep } from 'lodash-es'
import _ from 'lodash-es'
import { get } from 'svelte/store'
import { processors } from '../component.js'
import { pages, site as activeSite, symbols, fields as siteFields } from './data/draft'
import sections from './data/sections'
import activePage, { id, fields as pageFields, code as pageCode } from './app/activePage'
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
    // TODO: fix this
    // page.sections.forEach(section => {
    //   if (section.symbolID === symbolID) {
    //     info.frequency++
    //     if (!info.pages.includes(page.id)) info.pages.push(page.name)
    //   }
    // })
  })
  return info
}

export function getSymbol(symbolID): SymbolType {
  return _find(get(symbols), ['id', symbolID]);
}

export async function buildStaticPage({ page = get(activePage), site = get(activeSite), page_sections = get(sections), locale = 'en', separateModules = false, no_js = false }) {
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
    ...page_sections.map(async section => {
      const symbol = typeof (section.symbol) === 'object' ? section.symbol : _find(site.symbols, ['id', section.symbol])
      const { html, css: postcss, js }: { html: string, css: string, js: string } = symbol.code
      const data = getComponentData({
        component: section,
        symbol,
        page,
        site,
        loc: locale
      })
      const { css, error } = await processors.css(postcss || '')
      return {
        html: `
          <div class="section" id="section-${section.id}">
            <div class="component">
              ${html} 
            </div>
          </div>`,
        js,
        css,
        data
      }
    }).filter(Boolean), // remove options blocks
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
      <meta name="generator" content="Primo" />
      ${res.head}
      <style>${res.css}</style>
    </head>
    <body id="page">
      ${res.html}
      ${!no_js ? `<script type="module">${buildModule(res.js)}</script>` : ``}
    </body>
  </html>
  `

  // fetch module & content to hydrate component
  function buildModule(js): string {
    return separateModules ? `\
      const path = window.location.pathname === '/' ? '' : window.location.pathname
      const [ {default:App} ] = await Promise.all([
        import(path + '/_module.js')
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
  symbol = Object.hasOwn(component, 'fields') && component ? component : component.symbol,
  page = get(activePage),
  site = get(activeSite),
  loc = get(locale),
  fallback = 'placeholder',
  include_parent_data = true
}) {

  // const symbol = Object.hasOwn(component, 'fields') && component ? component : component.symbol
  const component_content = _chain(symbol.fields)
    .map(field => {
      const field_value = component.content?.[loc]?.[field.key]
      // if field is static, use value from symbol content
      if (field.is_static) {
        const symbol_value = symbol.content?.[loc]?.[field.key]
        return {
          key: field.key,
          value: symbol_value
        }
      } else if (field_value !== undefined) {
        return {
          key: field.key,
          value: field_value
        }
      } else {
        const default_content = symbol.content?.[loc]?.[field.key]
        return {
          key: field.key,
          value: default_content || (fallback === 'placeholder' ? getPlaceholderValue(field) : getEmptyValue(field))
        }
      }
    })
    .keyBy('key')
    .mapValues('value')
    .value();

  const site_content = site.content[loc]
  const page_content = page.content[loc]

  return include_parent_data ? {
    ...site_content,
    ...page_content,
    ...component_content
  } : component_content
}

export function getPageData({
  page = get(activePage),
  site = get(activeSite),
  loc = get(locale)
}) {
  const page_content = page.content[loc]
  const site_content = site.content[loc]
  return {
    ...site_content,
    ...page_content,
  }
}