import type { Adapter, AssertCovered, CapabilityDescriptor, PluginMethods } from './types'

export type Session = {
	user_id: string
	email?: string
	roles: string[]
	/**
	 * Vendor-specific claims. Reading these couples the plugin to one adapter —
	 * prefer `roles`, which every adapter populates.
	 */
	claims?: Record<string, unknown>
}

/**
 * Identity, not user management. Creating and deleting users stays with the
 * vendor's own admin surface, so the interface holds across PocketBase users,
 * hosted redirect flows (Auth0, Clerk) and SSO.
 */
export type AuthAdapter = Adapter & {
	/** Resolve the session from an incoming request's cookies or headers. */
	current(request: { headers: Record<string, string> }): Promise<Session | null>
	verify_token(token: string): Promise<Session | null>
	/**
	 * Where to send someone to sign in. Redirect-based vendors return their
	 * hosted page; local adapters return Primo's own sign-in route.
	 */
	sign_in_url(options?: { redirect_to?: string }): Promise<string>
	sign_out(token: string): Promise<void>
	has_role(session: Session, role: string): boolean
}

const methods = ['current', 'verify_token', 'sign_in_url', 'sign_out', 'has_role'] as const

const _covered: AssertCovered<(typeof methods)[number], PluginMethods<AuthAdapter>> = true

export const auth: CapabilityDescriptor = {
	id: 'auth',
	label: 'Auth',
	description: 'Identify the visitor and check their roles.',
	methods,
	// Verifying a token the browser already holds proves nothing there; the
	// answer is only trustworthy on the server that checked it.
	server_only_methods: ['verify_token'],
	has_default_adapter: true
}
