import { script_version } from './publish-assets.js'

// Include the producer and compiler version in the input supplied by callers.
// On insecure HTTP, script_version returns a fresh token: safe full rebuilds.
export const input_fingerprint = (value, crypto_api = globalThis.crypto) => script_version(JSON.stringify(value), crypto_api)

export const page_file_name = (hash) => `p_${hash}.html`

// PocketBase preserves at most 100 base-name characters, then adds a suffix.
// The 99-character script base carries the full SHA-256 of its uploaded bytes.
export const script_file_name = (hash, version) => `s_${hash.slice(0, 32)}_${version}.js`

export function page_file_matches(file, hash) {
	return typeof file === 'string' && /^[a-f0-9]{64}$/.test(hash) && new RegExp(`^p_${hash}(?:_[a-z0-9]{10})?\\.html$`).test(file)
}

export function cached_script_version(file, stored_hash, hash) {
	if (typeof file !== 'string' || stored_hash !== hash || !/^[a-f0-9]{64}$/.test(hash)) return
	return new RegExp(`^s_${hash.slice(0, 32)}_([a-f0-9]{64})(?:_[a-z0-9]{10})?\\.js$`).exec(file)?.[1]
}
