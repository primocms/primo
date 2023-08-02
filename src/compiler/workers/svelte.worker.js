import registerPromiseWorker from 'promise-worker/register'
import {compile as svelte_compile} from '../lib/svelte-compiler.min.js'

registerPromiseWorker(async function ({ code, svelteOptions }) {
    const res = svelte_compile(code, svelteOptions)
    // need to turn response into json string to avoid error in promise-worker
    return JSON.stringify({ code: res?.js?.code, warnings: res.warnings })
})