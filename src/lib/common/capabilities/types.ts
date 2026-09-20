import { z } from 'zod'

/**
 * The v1 capability slots. A site configures at most one adapter per slot, and
 * plugin code reaches each one only as `primo.<id>.*`.
 *
 * This list is closed on purpose: every id here needs an interface that the
 * lowest-common-denominator vendor can implement, a default or a documented
 * "unconfigured" state, and an admin slot. Adding one is a deliberate act.
 */
export const CAPABILITY_IDS = ['storage', 'email', 'auth', 'data', 'search', 'hooks', 'payments', 'ai'] as const

export const CapabilityId = z.enum(CAPABILITY_IDS)
export type CapabilityId = (typeof CAPABILITY_IDS)[number]

/** Result of an adapter's connection test, shown per slot in the admin UI. */
export type VerifyResult = { ok: true } | { ok: false; error: string }

/**
 * Implemented by every adapter regardless of which slot it fills.
 *
 * Neither method is callable from plugin code, so neither appears in a
 * capability's `methods` list: `verify` is admin-facing and `raw` is the
 * vendor-locked escape hatch.
 */
export type Adapter = {
	verify(): Promise<VerifyResult>
	/**
	 * Passthrough to the underlying vendor SDK client.
	 *
	 * VENDOR-LOCKED. Anything built on `raw()` stops being portable — swapping
	 * the adapter for another vendor breaks it. Server-side only: the value is a
	 * live SDK handle that usually closes over credentials, so it never crosses
	 * into the browser facade.
	 */
	raw(): unknown
}

/** Exposed to the admin UI's "test connection", never to plugin code. */
export const ADMIN_METHOD = 'verify'

/** Vendor-locked escape hatch. Server-side only. */
export const RAW_METHOD = 'raw'

/** Methods a capability adds on top of the shared {@link Adapter} surface. */
export type PluginMethods<T> = Exclude<keyof T, keyof Adapter> & string

/**
 * Compile-time check that a capability's runtime `methods` list covers every
 * method on its interface. Drift between the two becomes a type error rather
 * than a method that silently can't be called through the facade.
 */
export type AssertCovered<Listed extends string, Declared extends string> = [Exclude<Declared, Listed>] extends [never] ? true : { missing_from_methods_list: Exclude<Declared, Listed> }

/**
 * Runtime description of a capability. Canonical source for the admin slot UI,
 * the server-side authorization check, and `primo plugin check`.
 */
export type CapabilityDescriptor = {
	id: CapabilityId
	label: string
	description: string
	/** Method names plugin code may call through `primo.<id>.*`. */
	methods: readonly string[]
	/**
	 * Subset of `methods` that only server-side plugin code may call. Calling one
	 * from a block running in the browser is refused by the facade.
	 */
	server_only_methods: readonly string[]
	/**
	 * Whether Primo ships an adapter that works on a fresh instance with no
	 * credentials. Slots without one report "not configured" until a vendor is
	 * picked in the admin UI.
	 */
	has_default_adapter: boolean
}
