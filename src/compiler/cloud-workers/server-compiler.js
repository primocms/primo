import vm from 'vm'
import { Volume } from 'memfs'
import _ from 'lodash-es'
import rollup from './server-rollup'

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
  } else if (buildStatic && res.ssr) {
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

    // Create a new in-memory volume
    const code_path = `/${component.id}.js`
    const vol = Volume.fromJSON({
      [code_path]: res.ssr.replace('export { Component as default }', 'module.exports = Component'),
    })

    // Initialize a common sandbox structure
    const sandbox = {
      console,
      module: {},
      exports: {},
    }

    // Execute the script
    executeInVm(vol.readFileSync(code_path, 'utf8'), sandbox)
    const App = sandbox.module.exports // Access the exported content

    // Render using the exported component
    const rendered = App.render(component_data)

    payload = {
      head: rendered.head,
      html: rendered.html,
      css: rendered.css.code,
      js: res.dom,
    }
  } else {
    payload = {
      js: res.dom,
    }
  }

  return payload
}

// Utility function for executing scripts in a VM context
function executeInVm(scriptContent, sandbox) {
  const script = new vm.Script(scriptContent)
  vm.createContext(sandbox) // Setup the context for the sandbox
  script.runInContext(sandbox)
}
