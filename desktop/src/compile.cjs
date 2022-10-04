const {rollup} = require("rollup/dist/rollup.js")
const svelte = require('svelte/compiler')
const fetch = require('node-fetch')

// Based on https://github.com/pngwn/REPLicant

const CDN_URL = "https://cdn.jsdelivr.net/npm";
const cached_modules = new Map();

async function fetch_package(url) {
    if (cached_modules.has(url)) {
        return cached_modules.get(url)
    } else {
        const res = (await fetch(url)).text();
        cached_modules.set(url, res);
        return res
    }
}

exports.compileSvelte = async function compileSvelte({code,hydrated=false,buildStatic = true, format = 'esm'}) {

  const final = {
      ssr: '',
      dom: '',
      error: null
  }

  const component_lookup = new Map();

  function generate_lookup(code) {
      component_lookup.set(`./App.svelte`, code);
      component_lookup.set(`./H.svelte`, `
          <script>
              import {onMount} from 'svelte'
              let className = '';
              export { className as class };

              let heading;
              let currentLevel = 1;
              let headingLevel = 1
              onMount(() => {
                  document.body.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
                      if (h.isSameNode(heading)) {
                          headingLevel = currentLevel
                      } else if (currentLevel < 6) {
                          currentLevel = currentLevel + 1;
                      } else {
                          headingLevel = 6
                      }
                  })
              })
          </script>
          {#if headingLevel === 1}
              <h1 bind:this={heading} class={className}><slot>Empty H1</slot></h1>
          {:else if headingLevel === 2}
              <h2 bind:this={heading} class={className}><slot>Empty h2</slot></h2>
          {:else if headingLevel === 3}
              <h3 bind:this={heading} class={className}><slot>Empty h3</slot></h3>
          {:else if headingLevel === 4}
              <h4 bind:this={heading} class={className}><slot>Empty h4</slot></h4>
          {:else if headingLevel === 5}
              <h5 bind:this={heading} class={className}><slot>Empty h5</slot></h5>
          {:else if headingLevel === 6}
              <h6 bind:this={heading} class={className}><slot>Empty h6</slot></h6>
          {/if}
      `);
  }

  generate_lookup(code);

  if (buildStatic) {
      const bundle = await compile({
          generate: 'ssr',
          hydratable: true
      })

      const output = (await bundle.generate({ format })).output[0].code;
      final.ssr = output

  } else {
      const bundle = await compile({ dev: true })
      const output = (await bundle.generate({ format })).output[0].code;
      final.dom = output
  }

  // If static build needs to be hydrated, include Svelte JS (or just render normal component)
  if (hydrated) {
      const bundle = await compile({ 
          css: false,
          hydratable: true
      })
      const output = (await bundle.generate({ format })).output[0].code;
      final.dom = output
  } 

  async function compile(svelteOptions = {}) {
      return await rollup({
          input: "./App.svelte",
          plugins: [
              {
                  name: "repl-plugin",
                  async resolveId(importee, importer) {
  
                      // handle imports from 'svelte'
  
                      // import x from 'svelte'
                      if (importee === "svelte") return `${CDN_URL}/svelte/index.mjs`;
  
                      // import x from 'svelte/somewhere'
                      if (importee.startsWith("svelte/")) {
                          return `${CDN_URL}/svelte/${importee.slice(7)}/index.mjs`;
                      }
  
                      // import x from './file.js' (via a 'svelte' or 'svelte/x' package)
                      if (importer && importer.startsWith(`${CDN_URL}/svelte`)) {
                          const resolved = new URL(importee, importer).href;
                          if (resolved.endsWith(".mjs")) return resolved;
                          return `${resolved}/index.mjs`;
                      }
  
                      // local repl components
                      if (component_lookup.has(importee)) return importee;
  
                      // relative imports from a remote package
                      if (importee.startsWith("."))
                          return new URL(importee, importer).href;
                      
                      if (importee.startsWith('http')) {
                          return importee
                      } else return `https://cdn.skypack.dev/${importee}`; // bare named module imports (importing an npm package)
                  },
                  async load(id) {
                      // local repl components are stored in memory
                      // this is our virtual filesystem
                      if (component_lookup.has(id))
                          return component_lookup.get(id);
  
                      // everything else comes from a cdn
                      return await fetch_package(id);
                  },
                  async transform(code, id) {
                      // our only transform is to compile svelte components
                      //@ts-ignore
                      if (/.*\.svelte/.test(id)) {
                          try {
                              const res = svelte.compile(code, svelteOptions)
                              // temporary workaround for handling when LocaleSelector.svelte breaks because of race condition
                              // TODO: find cause & remove workaround
                              if(res.vars?.[0]?.['name'] === 'undefined') {
                                  console.warn('Used temporary workaround to hide component')
                                  const newRes = svelte.compile('<div></div>', svelteOptions)
                                  return newRes.js.code
                              }
                              const warnings = res.warnings.filter(w => !w.message.startsWith(`Component has unused export`)).filter(w => !w.message.startsWith(`A11y: <img> element should have an alt attribute`))
                              if (warnings[0]) {
                                  final.error = warnings[0].toString()
                                  return ''
                              } else {
                                  return res.js.code;
                              }
                          } catch(e) {
                              final.error = e.toString()
                              return ''
                          }
                      }  
                  },
              },
          ],
      });
  }

  return final

}