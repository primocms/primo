// Hash the exact UTF-8 bytes uploaded as compiled_js, including the bundled
// runtime and Svelte's CSS scope classes, rather than just the authored script.
export async function script_version(js, crypto_api = globalThis.crypto) {
	if (crypto_api.subtle) {
		const digest = await crypto_api.subtle.digest('SHA-256', new TextEncoder().encode(js))
		return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
	}
	// Web Crypto digest requires a secure context. Keep HTTP self-hosted editors
	// working by giving each bundle a fresh cache key there (without stable reuse).
	return Array.from(crypto_api.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function symbol_script_url(symbol_id, versions) {
	const version = versions.get(symbol_id)
	if (!version) throw new Error(`Missing compiled script for symbol ${symbol_id}.`)
	return `/_symbols/${symbol_id}.js?v=${version}`
}
