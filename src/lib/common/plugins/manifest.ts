import { z } from 'zod'
import { DataFieldType } from '../capabilities/data'
import { HookBinding } from '../capabilities/hooks'
import { CapabilityId } from '../capabilities/types'

const slug = z.string().regex(/^[a-z][a-z0-9_]*$/, 'must be lowercase letters, digits and underscores, starting with a letter')

const semver = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i, 'must be a semver version, e.g. 1.0.0')

export const PluginCollectionField = z
	.object({
		key: slug,
		type: DataFieldType,
		required: z.boolean().optional(),
		/** Key of another collection in this manifest. Required when `type` is `relation`. */
		collection: slug.optional()
	})
	.refine((field) => field.type !== 'relation' || !!field.collection, {
		message: 'a relation field needs a target collection',
		path: ['collection']
	})

export type PluginCollectionField = z.infer<typeof PluginCollectionField>

/**
 * A collection the plugin needs. Created on install and namespaced to the
 * plugin, so two plugins can both declare `submissions` without colliding.
 */
export const PluginCollection = z.object({
	key: slug,
	fields: z.array(PluginCollectionField).nonempty()
})

export type PluginCollection = z.infer<typeof PluginCollection>

export const CapabilityRequirement = z.object({
	capability: CapabilityId,
	/** The plugin installs and runs without this slot configured, with reduced function. */
	optional: z.boolean().optional(),
	/** Shown in the install screen and the marketplace listing. */
	reason: z.string().optional()
})

export type CapabilityRequirement = z.infer<typeof CapabilityRequirement>

/** `requires: ['data', 'email']` and the long form both parse to the long form. */
const requirement = z.union([CapabilityId.transform((capability) => ({ capability })), CapabilityRequirement])

export const PluginManifest = z
	.object({
		id: slug,
		name: z.string().nonempty(),
		version: semver,
		description: z.string().optional(),
		/** Capability slots the plugin may reach. Anything not listed here is unreachable at runtime. */
		requires: z.array(requirement).default([]),
		/** Collections to create on install. Only meaningful alongside the `data` capability. */
		collections: z.array(PluginCollection).default([]),
		/** Declarative event bindings. Only meaningful alongside the `hooks` capability. */
		hooks: z.array(HookBinding).default([])
	})
	.superRefine((manifest, ctx) => {
		const required = new Set(manifest.requires.map((entry) => entry.capability))

		const duplicate_requires = find_duplicates(manifest.requires.map((entry) => entry.capability))
		for (const capability of duplicate_requires) {
			ctx.addIssue({ code: 'custom', message: `"${capability}" is required more than once`, path: ['requires'] })
		}

		const duplicate_collections = find_duplicates(manifest.collections.map((collection) => collection.key))
		for (const key of duplicate_collections) {
			ctx.addIssue({ code: 'custom', message: `collection "${key}" is declared more than once`, path: ['collections'] })
		}

		if (manifest.collections.length > 0 && !required.has('data')) {
			ctx.addIssue({ code: 'custom', message: 'declaring collections needs the "data" capability in requires', path: ['collections'] })
		}

		if (manifest.hooks.length > 0 && !required.has('hooks')) {
			ctx.addIssue({ code: 'custom', message: 'declaring hooks needs the "hooks" capability in requires', path: ['hooks'] })
		}

		const collection_keys = new Set(manifest.collections.map((collection) => collection.key))
		manifest.collections.forEach((collection, collection_index) => {
			collection.fields.forEach((field, field_index) => {
				if (field.collection && !collection_keys.has(field.collection)) {
					ctx.addIssue({
						code: 'custom',
						message: `relation points at "${field.collection}", which this plugin doesn't declare`,
						path: ['collections', collection_index, 'fields', field_index, 'collection']
					})
				}
			})

			const duplicate_fields = find_duplicates(collection.fields.map((field) => field.key))
			for (const key of duplicate_fields) {
				ctx.addIssue({ code: 'custom', message: `field "${key}" is declared more than once`, path: ['collections', collection_index, 'fields'] })
			}
		})

		// A binding's action reaches another slot, so requiring `hooks` alone
		// isn't enough — the plugin has to declare what the action will touch.
		manifest.hooks.forEach((hook, index) => {
			const needed = HOOK_ACTION_CAPABILITY[hook.action]
			if (needed && !required.has(needed)) {
				ctx.addIssue({ code: 'custom', message: `the "${hook.action}" action needs the "${needed}" capability in requires`, path: ['hooks', index, 'action'] })
			}
		})
	})

export type PluginManifest = z.infer<typeof PluginManifest>

/** Capability a hook action reaches when it fires. `webhook` reaches none. */
const HOOK_ACTION_CAPABILITY: Record<string, CapabilityId | undefined> = {
	webhook: undefined,
	'email.send': 'email',
	'data.insert': 'data'
}

function find_duplicates(values: string[]): string[] {
	const seen = new Set<string>()
	const duplicates = new Set<string>()
	for (const value of values) {
		if (seen.has(value)) duplicates.add(value)
		seen.add(value)
	}
	return [...duplicates]
}

/** Whether the manifest lets the plugin reach a slot at all. */
export function requires_capability(manifest: PluginManifest, capability: CapabilityId): boolean {
	return manifest.requires.some((entry) => entry.capability === capability)
}
