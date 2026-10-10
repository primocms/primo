import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	optimizeDeps: {
		exclude: ['@rollup/browser']
	},
	server: {
		host: true,
		// The Vite dev server (:5173) only serves the frontend. The backend
		// (/api/primo/*, PocketBase REST at /api/*, files, admin at /_, and the
		// dev-reload websocket) is served by the Go server on :8090. Without
		// this proxy every /api call 404s and the editor hangs on the loader.
		proxy: {
			'/api': { target: 'http://localhost:8090', changeOrigin: true, ws: true },
			'/apis': { target: 'http://localhost:8090', changeOrigin: true },
			'/_': { target: 'http://localhost:8090', changeOrigin: true },
			'/__primo_dev_ws__': { target: 'http://localhost:8090', changeOrigin: true, ws: true },
			'/': {
				target: 'http://localhost:8090',
				changeOrigin: true,
				bypass(req) {
					const url = new URL(req.url ?? '/', 'http://localhost')
					// Thumbnails and their assets belong to the published site server.
					if (url.searchParams.has('_site')) return
					if (req.headers.referer) {
						try {
							const referrer = new URL(req.headers.referer)
							if (referrer.host === req.headers.host && referrer.searchParams.has('_site')) return
						} catch {
							// Ignore malformed referrers and let Vite handle the request.
						}
					}
					return req.url
				}
			}
		}
	},
	build: {
		rollupOptions: {
			output: {
				hashCharacters: 'base36'
			}
		}
	},
	plugins: [tailwindcss(), sveltekit()]
})
