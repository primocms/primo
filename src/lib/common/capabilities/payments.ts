import type { Adapter, AssertCovered, CapabilityDescriptor, PluginMethods } from './types'

/** Amounts are integers in the currency's minor unit (cents), never floats. */
export type Money = { amount: number; currency: string }

export type CheckoutLineItem = {
	name: string
	amount: number
	currency: string
	quantity: number
}

export type CheckoutStatus = 'open' | 'complete' | 'expired'

export type Checkout = {
	id: string
	/** Hosted page to send the buyer to. */
	url: string
	status: CheckoutStatus
	total: Money
	customer_email?: string
	metadata?: Record<string, string>
}

export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export type Transaction = {
	id: string
	status: TransactionStatus
	total: Money
	customer_email?: string
	/** ISO 8601. */
	created: string
}

export type PaymentEvent = {
	id: string
	/** Normalised across vendors; the vendor's own name is in `raw_type`. */
	type: 'checkout.completed' | 'payment.succeeded' | 'payment.failed' | 'payment.refunded'
	raw_type: string
	transaction?: Transaction
	checkout?: Checkout
}

/**
 * One-off payments through a hosted checkout page.
 *
 * Subscriptions, tax and invoicing are out of scope for v1 — they diverge too
 * far between vendors to sit behind one interface. Reach them through `raw()`,
 * accepting the vendor lock that implies.
 */
export type PaymentsAdapter = Adapter & {
	create_checkout(options: { items: CheckoutLineItem[]; success_url: string; cancel_url: string; customer_email?: string; metadata?: Record<string, string> }): Promise<Checkout>
	get_checkout(id: string): Promise<Checkout | null>
	/**
	 * Verify and parse an incoming webhook. Returns null when the signature does
	 * not match, which callers must treat as "drop the request".
	 *
	 * `body` is the raw request body — parsing it first invalidates the
	 * signature on every vendor.
	 */
	verify_webhook(body: string, signature: string): Promise<PaymentEvent | null>
	list_transactions(query?: { limit?: number; cursor?: string }): Promise<{ transactions: Transaction[]; cursor?: string }>
	/** Full refund when `amount` is omitted. */
	refund(transaction_id: string, amount?: number): Promise<Transaction>
}

const methods = ['create_checkout', 'get_checkout', 'verify_webhook', 'list_transactions', 'refund'] as const

const _covered: AssertCovered<(typeof methods)[number], PluginMethods<PaymentsAdapter>> = true

export const payments: CapabilityDescriptor = {
	id: 'payments',
	label: 'Payments',
	description: 'Take one-off payments through a hosted checkout.',
	methods,
	// Signature checking is meaningless in the browser, and moving money from
	// there is worse. Listing transactions would leak other people's orders.
	server_only_methods: ['verify_webhook', 'refund', 'list_transactions'],
	has_default_adapter: false
}
