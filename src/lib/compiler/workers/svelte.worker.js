import registerPromiseWorker from 'promise-worker/register'
import { compile as svelte_compile, compileModule } from 'svelte/compiler'

registerPromiseWorker(async function ({ code, svelteOptions, module = false }) {
	const res = module ? compileModule(code, { generate: svelteOptions.generate, dev: svelteOptions.dev }) : svelte_compile(code, svelteOptions)
	return {
		code: res?.js?.code,
		warnings: res.warnings.map((w) => ({ message: w.message, code: w.code }))
	}
})
