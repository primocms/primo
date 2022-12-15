const { app } = require('electron');
const { rollup } = require("rollup/dist/rollup.js")
const svelte = require('svelte/compiler')
const fetch = require('node-fetch')
const fs = require("fs-extra");

const userData = app.getPath('userData')
fs.ensureDirSync(`${userData}/fetched-modules`);

const CDN_URL = "https://cdn.jsdelivr.net/npm";

// Based on https://github.com/pngwn/REPLicant

const cached_modules = new Map();

async function fetch_package(url) {
    // Get local Svelte files
    if (url.startsWith('https://localsveltefiles.com/')) {
        const buffer = await fs.readFile(__dirname + '/' + url.slice(29));
        const fileContent = buffer.toString();
        return fileContent
    }

    // Get cached library files (i.e. accessed from file system in current session)
    const mod = cached_modules.get(url)
    if (mod) return mod

    // Get library files from file system & set to cache
    const libraryKey = url.replace('https://cdn.skypack.dev/', '').replace(/\//g, "_")
    const libraryLocation = `${userData}/libraries/${libraryKey}`
    const librarySaved = await fs.existsSync(libraryLocation)
    if (librarySaved) { // exists, retrieve
        const buffer = await fs.readFile(libraryLocation)
        const fileContent = buffer.toString();
        cached_modules.set(url, fileContent)
        return fileContent
    } else { // doesn't exist, fetch & store
        const res = await (await fetch(url)).text();
        cached_modules.set(url, res)
        fs.writeFile(libraryLocation, res);
        return res
    }

    // TODO: account for updated modules
}

exports.compileSvelte = async function compileSvelte({ component, hydrated = false, buildStatic = true, format = 'esm' }) {

    const final = {
        ssr: '',
        dom: '',
        error: null
    }

    const component_lookup = new Map();

    const Component_Code = (component) => {
        const dataAsVariables = `\
        ${Object.entries(component.data)
                .filter(field => field[0])
                .map(field => `export let ${field[0]};`)
                .join(`\n`)
            }`
        return `
        <script>
            ${dataAsVariables}
            ${component.js}
        </script>
        <style>${component.css}</style>
        ${component.html}`
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
                        // rollup needs a valid absolute url, so we're using this one
                        // there's probably a righter way to do this 
                        if (importee === "svelte") return `https://localsveltefiles.com/svelte/index.mjs`;

                        // import x from 'svelte/somewhere'
                        if (importee.startsWith("svelte/")) {
                            return `https://localsveltefiles.com/svelte/${importee.slice(7)}/index.mjs`;
                        }

                        // import x from './file.js' (via a 'svelte' or 'svelte/x' package)
                        if (importer && importer.startsWith(`https://localsveltefiles.com/svelte`)) {
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
                                if (res.vars?.[0]?.['name'] === 'undefined') {
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
                            } catch (e) {
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