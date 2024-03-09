import fs from 'fs'
import path from 'path'
import { Volume } from 'memfs'
import { Module } from 'module'
import { createRequire } from 'module'
import _ from 'lodash-es'
import rollup from './server-rollup'
import { Blob } from 'fetch-blob'
globalThis.Blob = Blob // use Node.js Blob instead of Jsdom's Blob

const COMPILED_COMPONENTS_CACHE = new Map()

/**
 * Compiles and renders a given component or page, caching the result.
 * @async
 * @param {Object} options - The options for rendering.
 * @param {Object|Object[]} options.component - The component(s) to be rendered. Can be a single component or an array of components for a page.
 * @param {boolean} [options.buildStatic=true] - Indicates whether to build the component statically or not.
 * @param {string} [options.format='esm'] - The module format to use, such as 'esm' for ES Modules.
 * @returns {Promise<Object>} Returns a payload containing the rendered HTML, CSS, JS, and other relevant data.
 * @throws {Error} Throws an error if the compilation or rendering fails.
 */
export async function html_server({ component, buildStatic = true, format = 'esm' }) {
  let cache_key
  if (!buildStatic) {
    cache_key = JSON.stringify({
      component,
      format,
    })
    if (COMPILED_COMPONENTS_CACHE.has(cache_key)) {
      return COMPILED_COMPONENTS_CACHE.get(cache_key)
    }
  }

  const compile_page = Array.isArray(component)

  let res
  try {
    const has_js = compile_page ? component.some((s) => s.js) : !!component.js
    res = await rollup({
      component,
      hydrated: buildStatic && has_js,
      buildStatic,
      format,
    })
    // console.log({ component, res })
  } catch (e) {
    console.log('error', e)
    res = {
      error: e.toString(),
    }
  }

  let payload

  if (!res) {
    payload = {
      html: '<h1 style="text-align: center">could not render</h1>',
    }
    res = {}
  } else if (res.error) {
    // console.error(res.error)
    payload = {
      html: '<h1 style="text-align: center">could not render</h1>',
      error: escapeHtml(res.error),
    }
    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }
  } else if (buildStatic) {
    let component_data
    if (compile_page) {
      // get the component data for the page
      component_data = component.reduce((accumulator, item, i) => {
        if (!_.isEmpty(item.data)) {
          accumulator[`component_${i}_props`] = item.data
        }
        return accumulator
      }, {})
    } else {
      component_data = component.data
    }

    const modulePath = `/${component.id}.js`
    const vol = new Volume()
    const moduleCode = res.ssr?.replace(
      'export { Component as default }',
      'module.exports = Component'
    )

    vol.writeFileSync(modulePath, moduleCode)
    try {
      // Override the readFileSync function temporarily
      fs.readFileSync = (path, options) => {
        if (path === modulePath) {
          return vol.readFileSync(path, options)
        }
        return originalFsReadFileSync(path, options)
      }

      const myModule = new Module(modulePath)
      const App = myModule.exports
      const rendered = App.render(component_data)

      payload = {
        head: rendered.head,
        html: rendered.html,
        css: rendered.css.code,
        js: res.dom,
      } 
    }

  } else {
    payload = {
      js: res.dom,
    }
  }

  return payload
}
