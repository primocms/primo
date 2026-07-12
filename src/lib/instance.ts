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
	editor_cap?: number
}

export const instance: InstanceInfo = await fetch(new URL('/api/primo/info', self.baseURL)).then((res) => res.json())
