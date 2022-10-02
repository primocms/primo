import _ from 'lodash-es'
import {get} from 'svelte/store'
import {site} from '@primo-app/primo/src/stores/data/draft'
import {locale} from '@primo-app/primo/src/stores/app/misc'

const componentsMap = new Map();

export async function html({ code, data, buildStatic = true, format = 'esm'}) {

  const finalRequest = buildFinalRequest(data)

  let cacheKey
  if (!buildStatic) {
    cacheKey = JSON.stringify({
      code, 
      data: Object.keys(data),
      format
    })
    if (componentsMap.has(cacheKey)) {
      const cached = componentsMap.get(cacheKey)
      return cached
    }
  }

  let res
  try {
    res = await window.primo?.processSvelte(finalRequest)
  } catch(e) {
    console.log('error', e)
    res = {
      error: e.toString()
    }
  }

  let final 

  if (!res) {
    final = {
      html: '<h1 style="text-align: center">could not render</h1>'
    }
    res = {}
  } else if (res.error) {
    console.log(data, res.error)
    final = {
      error: escapeHtml(res.error)
    }
    function escapeHtml(unsafe) {
      return unsafe
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
    }
  } else if (buildStatic) {   
    const blob = new Blob([res.ssr], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const {default:App} = await import(url/* @vite-ignore */)
    const rendered = App.render(data)
    final = {
      html: rendered.html || rendered.head,
      css: rendered.css.code,
      js: res.dom
    }
    // console.log({final})
  } else {
    final = {
      js: res.dom
    }
  } 

  if (!buildStatic) {
    componentsMap.set(cacheKey, final)
  }

  return final

  function buildFinalRequest(finalData) {

    const dataAsVariables = `\
    ${Object.entries(finalData)
      .filter(field => field[0])
      .map(field => `export let ${field[0]};`)
      .join(` \n`)
    }
   `

    const finalCode = `${code.html}
      ${ code.css 
        ? `<style>${code.css}</style>`
        : ``
      }
      ${ code.js || (!code.js && !code.html.includes('<script>'))
        ? `<script>${dataAsVariables}${code.js || ''}</script>`
        : ``
      }
    `
  
    const hydrated = !!code.js && buildStatic
  
    return {
      code: finalCode,
      hydrated,
      buildStatic,
      format,
      site: get(site),
      locale: get(locale)
    }
  }
}

const cssMap = new Map()
export async function css(raw) {
  if (!raw) {
    return ''
  }

  if (cssMap.has(raw)) return {
    css: cssMap.get(raw),
    error: null
  }

  if (!window.primo) return
  const { css, error } = await window.primo.processCSS(raw)
  
  if (css) cssMap.set(raw, css)
  
  return { css, error }
}