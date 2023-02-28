import { find as _find } from 'lodash-es'
import { rollup } from "../lib/rollup-browser";
import registerPromiseWorker from 'promise-worker/register'
import * as svelte from 'svelte/compiler'

// Based on https://github.com/pngwn/REPLicant

const CDN_URL = "https://cdn.jsdelivr.net/npm";

const cached_packages = new Map()

async function fetch_package(url) {
    if (cached_packages.has(url)) {
        return cached_packages.get(url)
    } else {
        const pck = await (await fetch(url)).text()
        cached_packages.set(url, pck)
        return pck;
    }
}

registerPromiseWorker(async function ({ component, hydrated, buildStatic = true, format = 'esm' }) {

    const final = {
        ssr: '',
        dom: '',
        error: null
    }

    const component_lookup = new Map();

    const Component_Code = (component) => {
        let { html, css, js, data } = component
        const dataAsVariables = `\
          ${Object.entries(data)
                .filter(field => field[0])
                .map(field => `export let ${field[0]};`)
                .join(`\n`)
            }`

        // Move <svelte:window> to the end of the component to prevent 'can't nest' error
        if (html.includes('<svelte:window')) {
            let [svelteWindowTag] = html.match(/<svelte:window(.*?)\/>/);
            html = html.replace(svelteWindowTag, '')
            html = html + svelteWindowTag
        }

        return `
          <script>
              ${dataAsVariables}
              ${js}
          </script>
          ${css ? `<style>${css}</style>` : ``}
          ${html}`
    }

    function generate_lookup(component) {
        if (Array.isArray(component)) { // build page (sections as components)
            component.forEach((section, i) => {
                const code = Component_Code(section)
                component_lookup.set(`./Component_${i}.svelte`, code);
            })
            component_lookup.set(`./App.svelte`, `
              <script>
              ${component.map((_, i) => `import Component_${i} from './Component_${i}.svelte';`).join('')}
              </script>
              ${component.map((section, i) => {
                const props = `\
                      ${Object.entries(section.data)
                        .filter(field => field[0])
                        .map(field => `${field[0]}={${JSON.stringify(field[1])}}`)
                        .join(` \n`)}`
                return `<Component_${i} ${props} /> \n`
            }).join('')}
          `);
        } else { // build individual component
            const code = Component_Code(component)
            component_lookup.set(`./App.svelte`, code);
        }
    }

    generate_lookup(component);

    if (buildStatic) {

        const bundle = await compile({
            generate: 'ssr',
            hydratable: true
        })

        const output: string = (await bundle.generate({ format })).output[0].code;
        final.ssr = output

    } else {
        const bundle = await compile()
        const output: string = (await bundle.generate({ format })).output[0].code;
        final.dom = output
    }

    // If static build needs to be hydrated, include Svelte JS (or just render normal component)
    if (hydrated) {
        const bundle = await compile({
            css: false,
            hydratable: true
        })
        const output: string = (await bundle.generate({ format })).output[0].code;
        final.dom = output
    }

    async function compile(svelteOptions = {}) {
        return await rollup({
            input: "./App.svelte",
            plugins: [
                {
                    name: "repl-plugin",
                    async resolveId(importee: string, importer: string) {

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
                        }

                        // get the package.json and load it into memory
                        const pkg_url = `${CDN_URL}/${importee}/package.json`;
                        const fetched = await fetch_package(pkg_url)
                        const pkg = typeof (fetched) === 'object' ? JSON.parse(await fetch_package(pkg_url)) : null;

                        // get an entry point from the pkg.json - first try svelte, then modules, then main
                        if (pkg && (pkg.svelte || pkg.module || pkg.main)) {
                            // use the aobove url minus `/package.json` to resolve the URL
                            const url = pkg_url.replace(/\/package\.json$/, "");
                            return new URL(pkg.svelte || pkg.module || pkg.main, `${url}/`)
                                .href;
                        } else return `https://cdn.skypack.dev/${importee}`; // use skypack as a fallback

                        return importee; // everything else

                    },
                    async load(id: string) {
                        // local repl components are stored in memory
                        // this is our virtual filesystem
                        if (component_lookup.has(id))
                            return component_lookup.get(id);

                        // everything else comes from a cdn
                        return await fetch_package(id);
                    },
                    async transform(code: string, id: string) {
                        // our only transform is to compile svelte components
                        //@ts-ignore
                        if (/.*\.svelte/.test(id)) {
                            try {
                                const res = svelte.compile(code, svelteOptions)
                                // temporary workaround for handling when LocaleSelector.svelte breaks because of race condition
                                // TODO: find cause & remove workaround
                                if (res.vars?.[0]?.['name'] === 'undefined') {
                                    console.warn('Used temporary workaround to hide component')
                                    let newRes = svelte.compile('<div></div>', svelteOptions)
                                    return newRes.js.code
                                }
                                const warnings = res.warnings
                                    .filter(w => !w.message.startsWith(`Component has unused export`))
                                    .filter(w => !w.message.startsWith(`A11y: <img> element should have an alt attribute`))
                                    .filter(w => w.code !== `a11y-missing-content`)
                                if (warnings[0]) {
                                    final.error = warnings[0].toString()
                                    return ''
                                } else {
                                    return res.js.code;
                                }
                            } catch (e) {
                                console.log({ e })
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

})