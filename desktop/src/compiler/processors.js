import _ from 'lodash-es'
import {get} from 'svelte/store'
import {site} from '@primo-app/primo/stores/data/draft'
import {locale} from '@primo-app/primo/stores/app/misc'

const componentsMap = new Map();

export async function html({ component, buildStatic = true, format = 'esm'}) {

  let cacheKey
  if (!buildStatic) {
    cacheKey = JSON.stringify({
      component,
      format
    })
    if (componentsMap.has(cacheKey)) {
      const cached = componentsMap.get(cacheKey)
      return cached
    }
  }

  let res
  try {
    const has_js = Array.isArray(component) ? component.some(s => s.js) : !!component.js
    res = await window.primo?.processSvelte({
      component,
      hydrated: buildStatic && has_js,
      buildStatic,
      format,
      site: get(site),
      locale: get(locale)
    })
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
    console.error(res.error)
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
    console.log({res})
    const blob = new Blob([res.ssr], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const {default:App} = await import(url/* @vite-ignore */)
    const rendered = App.render(component.data)
    final = {
      head: rendered.head,
      html: rendered.html,
      css: rendered.css.code,
      js: res.dom
    }
  } else {
    final = {
      js: res.dom
    }
  } 

  if (!buildStatic) {
    componentsMap.set(cacheKey, final)
  }

  return final
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