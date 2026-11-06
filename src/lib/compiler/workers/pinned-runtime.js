import svelte from 'svelte/package.json'
import { createPinnedRuntime } from './pinned-runtime-resolver.js'

// Emit the exact locked npm sources as hashed, same-origin assets. The worker
// bundles these itself, so keep their relative imports as original source.
// Include the licenses alongside the MIT-licensed runtime dependencies.
const files = import.meta.glob([
	'/node_modules/svelte/src/**/*.js',
	'!/node_modules/svelte/src/compiler/**',
	'/node_modules/svelte/LICENSE',
	'/node_modules/clsx/dist/clsx.mjs',
	'/node_modules/clsx/license',
	'/node_modules/devalue/index.js',
	'/node_modules/devalue/src/**/*.js',
	'/node_modules/devalue/LICENSE'
], { exhaustive: true, eager: true, query: '?url&no-inline', import: 'default' })

const assets = Object.fromEntries(Object.entries(files).map(([name, url]) => [name.replace('/node_modules/', ''), String(url)]))
const runtime = createPinnedRuntime(svelte, assets)
export const resolvePinnedRuntime = runtime.resolve
export const pinnedRuntimeAsset = runtime.asset
