import { self } from './pocketbase/instances'

export type InstanceInfo = {
	id: string
	version: string
	telemetry_enabled: boolean
	smtp_enabled: boolean
	hosted_mode: boolean
	billing_url?: string
	dev_mode: boolean
	site_cap?: number
	site_count: number
	library_block_count: number
	editor_cap?: number
	// Domain provider ("railway" runs attach+poll, "manual" shows generic DNS
	// guidance) and the configured base domain (if set, new sites get a live
	// "<slug>.<base>" subdomain). Both drive the connect-domain flow and let the
	// dashboard tell a reachable host from a not-yet-connected one.
	domain_provider: string
	base_domain?: string
}

// Keep module evaluation synchronous. Safari can evaluate a dependent collection
// before its manager initializes when this fetch is a top-level await.
export const instance: InstanceInfo = {
	id: '', version: '', telemetry_enabled: false, smtp_enabled: false,
	hosted_mode: false, dev_mode: false, site_count: 0, library_block_count: 0,
	domain_provider: 'manual'
}

// The client init hook owns this barrier; no application UI mounts before it.
export const instance_ready = Promise.resolve()
	.then(() => fetch(new URL('/api/primo/info', self.baseURL)))
	.then(async (response) => {
		if (!response.ok) throw new Error(`Could not load Primo settings (HTTP ${response.status})`)
		const info = await response.json()
		if (!info || typeof info.id !== 'string' || typeof info.version !== 'string' ||
			['telemetry_enabled', 'smtp_enabled', 'hosted_mode', 'dev_mode'].some((key) => typeof info[key] !== 'boolean')) {
			throw new Error('Invalid Primo settings response')
		}
		Object.assign(instance, info)
		return instance
	})

// Preloading may finish before init attaches its await. Observe that interim
// rejection without changing the barrier's rejected state or permitting startup.
void instance_ready.catch(() => {})
