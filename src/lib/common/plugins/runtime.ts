import { z } from 'zod'
import { capabilities, is_capability_id } from '../capabilities'
import { ADMIN_METHOD, CapabilityId, RAW_METHOD } from '../capabilities/types'
import { requires_capability, type PluginManifest } from './manifest'

/**
 * Where the call originates. Blocks rendered in a visitor's browser are
 * `browser`; hook handlers and server-rendered code are `server`.
 */
export type InvocationSource = 'browser' | 'server'

/**
 * The wire format for one capability call.
 *
 * Plugin code never holds an adapter, a vendor SDK or a credential: it builds
 * one of these and the server resolves it against the site's configured
 * adapter. That indirection is the whole reason keys stay server-side.
 */
export const CapabilityInvocation = z.object({
	plugin_id: z.string().nonempty(),
	capability: CapabilityId,
	method: z.string().nonempty(),
	args: z.array(z.unknown()).default([])
})

export type CapabilityInvocation = z.infer<typeof CapabilityInvocation>

export type CapabilityErrorCode = 'unknown_capability' | 'not_declared' | 'unknown_method' | 'server_only'

export class CapabilityError extends Error {
	code: CapabilityErrorCode

	constructor(code: CapabilityErrorCode, message: string) {
		super(message)
		this.name = 'CapabilityError'
		this.code = code
	}
}

/**
 * The authorization check. Runs on the server for every invocation, and again
 * in the facade so plugin authors see the failure where they wrote the call
 * rather than as a rejected request.
 *
 * @throws {CapabilityError}
 */
export function authorize_invocation(manifest: PluginManifest, invocation: { capability: string; method: string }, source: InvocationSource = 'browser'): void {
	const { capability, method } = invocation

	if (!is_capability_id(capability)) {
		throw new CapabilityError('unknown_capability', `"${capability}" isn't a Primo capability. Available: ${Object.keys(capabilities).join(', ')}.`)
	}

	if (!requires_capability(manifest, capability)) {
		throw new CapabilityError('not_declared', `Plugin "${manifest.id}" called primo.${capability}.${method} but doesn't require "${capability}". Add it to requires in the plugin manifest.`)
	}

	const descriptor = capabilities[capability]

	if (method === RAW_METHOD) {
		throw new CapabilityError('server_only', `primo.${capability}.raw() isn't available to plugin code. It returns a vendor SDK client that holds credentials, so it stays on the server.`)
	}

	if (method === ADMIN_METHOD) {
		throw new CapabilityError('server_only', `primo.${capability}.verify() isn't available to plugin code. Connection testing belongs to the admin UI.`)
	}

	if (!descriptor.methods.includes(method)) {
		throw new CapabilityError('unknown_method', `"${method}" isn't a method on the ${capability} capability. Available: ${descriptor.methods.join(', ')}.`)
	}

	if (source === 'browser' && descriptor.server_only_methods.includes(method)) {
		throw new CapabilityError('server_only', `primo.${capability}.${method}() can only be called from server-side plugin code, not from a block running in the browser.`)
	}
}

/** Transport that carries an invocation to the server and resolves its result. */
export type Invoke = (invocation: CapabilityInvocation) => Promise<unknown>

export type CapabilityFacade = Record<string, (...args: unknown[]) => Promise<unknown>>

export type PluginRuntime = Record<string, CapabilityFacade>

/**
 * Build the `primo` object a plugin's code sees.
 *
 * It holds exactly the capabilities the manifest requires and, within each,
 * exactly the methods that source is allowed to call — no adapters, no SDK
 * handles, no credentials. Reaching for anything else throws a
 * {@link CapabilityError} naming what to change.
 */
export function create_plugin_runtime(manifest: PluginManifest, invoke: Invoke, options: { source?: InvocationSource } = {}): PluginRuntime {
	const source = options.source ?? 'browser'

	const declared: PluginRuntime = {}

	for (const { capability } of manifest.requires) {
		const descriptor = capabilities[capability]
		const facade: CapabilityFacade = {}

		for (const method of descriptor.methods) {
			if (source === 'browser' && descriptor.server_only_methods.includes(method)) continue

			facade[method] = (...args: unknown[]) => {
				authorize_invocation(manifest, { capability, method }, source)
				return invoke({ plugin_id: manifest.id, capability, method, args })
			}
		}

		declared[capability] = new Proxy(Object.freeze(facade), {
			get(target, property, receiver) {
				if (typeof property !== 'string' || property in target) return Reflect.get(target, property, receiver)
				// Surface the reason rather than handing back undefined and letting
				// it fail later as "not a function".
				authorize_invocation(manifest, { capability, method: property }, source)
				return undefined
			}
		})
	}

	return new Proxy(Object.freeze(declared), {
		get(target, property, receiver) {
			if (typeof property !== 'string' || property in target) return Reflect.get(target, property, receiver)
			authorize_invocation(manifest, { capability: property, method: '<unknown>' }, source)
			return undefined
		}
	})
}
