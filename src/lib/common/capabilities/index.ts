import { ai } from './ai'
import { auth } from './auth'
import { data } from './data'
import { email } from './email'
import { hooks } from './hooks'
import { payments } from './payments'
import { search } from './search'
import { storage } from './storage'
import { CAPABILITY_IDS, type CapabilityDescriptor, type CapabilityId } from './types'

/**
 * Canonical capability table. The admin slot UI, the server-side authorization
 * check, the plugin runtime facade and `primo plugin check` all read from here
 * rather than keeping their own copies.
 */
export const capabilities: Record<CapabilityId, CapabilityDescriptor> = {
	storage,
	email,
	auth,
	data,
	search,
	hooks,
	payments,
	ai
}

export const capability_list: CapabilityDescriptor[] = CAPABILITY_IDS.map((id) => capabilities[id])

export function is_capability_id(value: string): value is CapabilityId {
	return value in capabilities
}

/** Whether plugin code may call `primo.<capability>.<method>` at all. */
export function is_capability_method(capability: CapabilityId, method: string): boolean {
	return capabilities[capability].methods.includes(method)
}

/** Whether a method is refused when called from a block running in the browser. */
export function is_server_only_method(capability: CapabilityId, method: string): boolean {
	return capabilities[capability].server_only_methods.includes(method)
}

export * from './types'
export * from './storage'
export * from './email'
export * from './auth'
export * from './data'
export * from './search'
export * from './hooks'
export * from './payments'
export * from './ai'
