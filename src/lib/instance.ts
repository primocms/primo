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

export const instance: InstanceInfo = await fetch(new URL('/api/primo/info', self.baseURL)).then((res) => res.json())
