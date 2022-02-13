import * as idb from 'idb-keyval';
import {clone as _cloneDeep} from 'lodash-es'
import PromiseWorker from 'promise-worker';
import svelteWorker from './workers/worker?worker'
import {get} from 'svelte/store'
import {site} from '@primo-app/primo/src/stores/data/draft'

import postCSSWorker from './workers/postcss.worker?worker'
const PostCSSWorker = new postCSSWorker
const cssPromiseWorker = new PromiseWorker(PostCSSWorker);

const SvelteWorker = new svelteWorker()
const htmlPromiseWorker = new PromiseWorker(SvelteWorker);

export async function html({ code, data, buildStatic = true, format = 'esm'}) {

  let finalRequest = buildFinalRequest(data)

  // const cached = await idb.get(JSON.stringify(finalRequest))
  // if (cached) {
  //   return cached
  // }

  finalRequest = buildFinalRequest(data)

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
    const rendered = App.render()
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

  // await idb.set(JSON.stringify(finalRequest), final)
  return final

  function buildFinalRequest(data) {


    const dataAsVariables = `\
    ${Object.entries(data)
      .filter(field => field[0])
      .map(field => `export let ${field[0]} = ${JSON.stringify(field[1])};`)
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
      site: get(site)
    }
  }

}


export async function css(raw) {
  const processed = await cssPromiseWorker.postMessage({
    css: raw
  })
  if (processed.message) {
    return {
      error: processed.message
    }
  }
  return {
    css: processed
  }
}