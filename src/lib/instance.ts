import { self } from './pocketbase/instances'

export type InstanceInfo = {
	id: string
	version: string
	telemetry_enabled: boolean
	smtp_enabled: boolean
	hosted_mode: boolean
	billing_url?: string
	dev_mode: boolean
}

export const instance: InstanceInfo = await fetch(new URL('/api/palacms/info', self.baseURL)).then((res) => res.json())
