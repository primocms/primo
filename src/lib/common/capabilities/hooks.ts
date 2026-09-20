import { z } from 'zod'
import type { Adapter, AssertCovered, CapabilityDescriptor, PluginMethods } from './types'

/**
 * Events a plugin may bind to. `cron` fires on the schedule given in the
 * binding's config; the rest are raised by the CMS.
 */
export const HOOK_EVENTS = ['page.published', 'content.changed', 'form.submitted', 'cron'] as const

export const HookEvent = z.enum(HOOK_EVENTS)
export type HookEvent = (typeof HOOK_EVENTS)[number]

/**
 * What a binding is allowed to do when it fires.
 *
 * Deliberately a closed list rather than a callback: on hosted instances there
 * is no arbitrary JS execution, so a binding is data the server can inspect,
 * rate-limit and refuse. Self-hosters who want more write PocketBase hooks.
 */
export const HOOK_ACTIONS = ['webhook', 'email.send', 'data.insert'] as const

export const HookAction = z.enum(HOOK_ACTIONS)
export type HookAction = (typeof HOOK_ACTIONS)[number]

export const HookBinding = z
	.object({
		on: HookEvent,
		action: HookAction,
		/**
		 * Action-specific settings — a URL for `webhook`, a message template for
		 * `email.send`, a target collection for `data.insert`. Each action
		 * validates its own shape when the manifest is installed.
		 */
		config: z.record(z.string(), z.unknown()),
		/** Required when `on` is `cron`. Standard five-field cron expression. */
		schedule: z.string().optional()
	})
	.refine((binding) => binding.on !== 'cron' || !!binding.schedule, {
		message: 'a cron binding needs a schedule',
		path: ['schedule']
	})

export type HookBinding = z.infer<typeof HookBinding>

/**
 * Bindings themselves are declared in the manifest, not registered at runtime,
 * so this surface is only for raising and inspecting.
 */
export type HooksAdapter = Adapter & {
	/** Raise one of the plugin's own events. Bindings on it fire. */
	emit(event: string, payload: Record<string, unknown>): Promise<void>
	list(): Promise<HookBinding[]>
}

const methods = ['emit', 'list'] as const

const _covered: AssertCovered<(typeof methods)[number], PluginMethods<HooksAdapter>> = true

export const hooks: CapabilityDescriptor = {
	id: 'hooks',
	label: 'Hooks',
	description: 'Run a declared action when something happens on the site.',
	methods,
	// A browser that can emit arbitrary events can drive the webhook and email
	// actions on demand, which is a spam relay with extra steps.
	server_only_methods: ['emit'],
	has_default_adapter: true
}
