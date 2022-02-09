import _ from 'lodash'
import PromiseWorker from 'promise-worker';
import svelteWorker from './workers/worker?worker'
import {get} from 'svelte/store'
import {site} from '@primo-app/primo/src/stores/data/draft'
import {locale} from '@primo-app/primo/src/stores/app/misc'
import * as idb from 'idb-keyval'

const SvelteWorker = new svelteWorker()
const htmlPromiseWorker = new PromiseWorker(SvelteWorker);

export async function html({ code, data, buildStatic = true, format = 'esm'}) {

  const finalRequest = buildFinalRequest(data)

  let cacheKey
  if (buildStatic) {
    cacheKey = JSON.stringify({
      code, 
      data: Object.keys(data),
      buildStatic,
      format
    })
    const cached = await idb.get(cacheKey) 
    if (cached) return cached
  }

  let res
  try {
    res = await htmlPromiseWorker.postMessage(finalRequest)
  } catch(e) {
    console.log('error', e)
    res = {
      error: e.toString()
    }
  }

  let final 

  if (res.error) {
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
    idb.set(cacheKey, final)
  }

  return final

  function buildFinalRequest(finalData) {

    // export const primo = ${JSON.stringify(finalData)}

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


export async function css(raw) {
  if (!raw) {
    return ''
  }
  // const cached = await idb.get(raw)
  // if (cached) {
  //   return cached
  // }

  const { css, error } = await window.primo.processCSS(raw)
  
  // await idb.set(raw, css || error)
  return { css, error }
}