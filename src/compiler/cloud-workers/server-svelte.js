import { compile as svelte_compile } from '../lib/svelte-compiler.min.js'
// import { compile as svelte_compile } from '../lib/svelte-5/compiler/index.js'

export default async function svelte({ code, svelteOptions }) {
	const res = svelte_compile(code, svelteOptions)
	return {
		code: res?.js?.code,
		warnings: res.warnings.map((w) => ({ message: w.message, code: w.code }))
	}
}
