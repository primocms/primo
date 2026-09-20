import type { Adapter, AssertCovered, CapabilityDescriptor, PluginMethods } from './types'

export type EmailMessage = {
	to: string | string[]
	subject: string
	text: string
	html?: string
	/** Falls back to the instance's configured sender when omitted. */
	from?: string
	reply_to?: string
}

/**
 * Transactional send only.
 *
 * Lists, templates, campaigns and delivery tracking are out of scope for v1 —
 * SMTP can't do them, so putting them in the interface would shape it around
 * one class of vendor. Reach them through `raw()`.
 */
export type EmailAdapter = Adapter & {
	send(message: EmailMessage): Promise<{ id: string }>
	/**
	 * Adapters without a batch endpoint send serially, so a partial failure is
	 * possible: `ids` is ordered to match `messages` and the call rejects on the
	 * first send that fails.
	 */
	send_batch(messages: EmailMessage[]): Promise<{ ids: string[] }>
}

const methods = ['send', 'send_batch'] as const

const _covered: AssertCovered<(typeof methods)[number], PluginMethods<EmailAdapter>> = true

export const email: CapabilityDescriptor = {
	id: 'email',
	label: 'Email',
	description: 'Send transactional email.',
	methods,
	// Letting a browser block send arbitrary mail turns the instance into an open
	// relay. Blocks reach email through a hook action instead.
	server_only_methods: ['send', 'send_batch'],
	has_default_adapter: true
}
