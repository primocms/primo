import PromiseWorker from 'promise-worker';
import {find as _find} from 'lodash-es'
import {rollup} from "../lib/rollup-browser";
import registerPromiseWorker from 'promise-worker/register'
import * as svelte from 'svelte/compiler'
import {locales} from '@primo-app/primo/src/const'

// Based on https://github.com/pngwn/REPLicant

const CDN_URL = "https://cdn.jsdelivr.net/npm";

async function fetch_package(url) {
    return (await fetch(url)).text();
}

registerPromiseWorker(async function ({code,site,locale,hydrated,buildStatic = true, format = 'esm'}) {

    const final = {
        ssr: '',
        dom: '',
        error: null
    }

    const component_lookup = new Map();

    function generate_lookup(code) {
        component_lookup.set(`./App.svelte`, code);
        component_lookup.set('./LocaleSelector.svelte', `
            <script>
                const currentLocale = window.location.pathname.split('/').slice(1)[0]
                let locale = ${JSON.stringify(locales.map(l => l.key))}.includes(currentLocale) ? currentLocale : 'en'
                function navigateToLocale(e) {
                    const loc = e.target.value
                    if (!['localhost', '-'].includes(window.location.hostname)) {
                        window.location.href = '/' + (loc === 'en' ? '' : loc)
                    }
                }
            </script>
            <div class="locale-selector">
                <svg
                    width="17"
                    height="17"
                    viewBox="0 0 17 17"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0_65_92)">
                    <path
                        d="M8.5 0.5C4.08065 0.5 0.5 4.08065 0.5 8.5C0.5 12.9194 4.08065 16.5 8.5 16.5C12.9194 16.5 16.5 12.9194 16.5 8.5C16.5 4.08065 12.9194 0.5 8.5 0.5ZM14.2839 5.66129H12.1161C11.9 4.48387 11.5516 3.44194 11.1097 2.60645C12.4935 3.21935 13.6161 4.30645 14.2839 5.66129ZM8.5 2.04839C9.1 2.04839 10.0677 3.37742 10.5387 5.66129H6.46129C6.93226 3.37742 7.9 2.04839 8.5 2.04839ZM2.04839 8.5C2.04839 8.05806 2.09355 7.62581 2.17742 7.20968H4.68387C4.65161 7.63226 4.62903 8.05806 4.62903 8.5C4.62903 8.94194 4.65161 9.36774 4.68387 9.79032H2.17742C2.09355 9.37419 2.04839 8.94194 2.04839 8.5ZM2.71613 11.3387H4.88387C5.1 12.5161 5.44839 13.5581 5.89032 14.3935C4.50645 13.7806 3.38387 12.6935 2.71613 11.3387ZM4.88387 5.66129H2.71613C3.38387 4.30645 4.50645 3.21935 5.89032 2.60645C5.44839 3.44194 5.1 4.48387 4.88387 5.66129ZM8.5 14.9516C7.9 14.9516 6.93226 13.6226 6.46129 11.3387H10.5419C10.0677 13.6226 9.1 14.9516 8.5 14.9516ZM10.7613 9.79032H6.23871C6.20323 9.37742 6.17742 8.95161 6.17742 8.5C6.17742 8.04839 6.20323 7.62258 6.23871 7.20968H10.7645C10.8 7.62258 10.8258 8.04839 10.8258 8.5C10.8258 8.95161 10.7968 9.37742 10.7613 9.79032ZM11.1097 14.3935C11.5516 13.5581 11.8968 12.5161 12.1161 11.3387H14.2839C13.6161 12.6935 12.4935 13.7806 11.1097 14.3935ZM12.3161 9.79032C12.3484 9.36774 12.371 8.94194 12.371 8.5C12.371 8.05806 12.3484 7.63226 12.3161 7.20968H14.8226C14.9065 7.62581 14.9516 8.05806 14.9516 8.5C14.9516 8.94194 14.9065 9.37419 14.8226 9.79032H12.3161Z"
                        fill="currentColor" />
                    </g>
                    <defs>
                    <clipPath id="clip0_65_92">
                        <rect
                        width="16"
                        height="16.5161"
                        fill="white"
                        transform="translate(0.5 0.241943)" />
                    </clipPath>
                    </defs>
                </svg>          
                <select value={locale} on:change={navigateToLocale}>
                    ${
                        Object.keys(site.content).map(option => `
                            <option ${locale === option ? 'selected' : ''} value="${option}">${_find(locales, ['key', option])['name']}</option>
                        `).join('')
                    }
                </select>
            </div>
            <style>
                .locale-selector {
                    display: flex;
                    align-items: center;
                }

                svg {
                    margin-right: 0.25rem;
                }
            </style>
        `)
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
                        } else return `https://cdn.skypack.dev/${importee}`; // bare named module imports (importing an npm package)

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
  
})