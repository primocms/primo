import type { Adapter, AssertCovered, CapabilityDescriptor, PluginMethods } from './types'

export type AiMessage = { role: 'user' | 'assistant'; content: string }

export type AiUsage = { input_tokens: number; output_tokens: number }

export type AiCompleteOptions = {
	messages: AiMessage[]
	system?: string
	max_tokens?: number
	temperature?: number
}

/**
 * Text generation and embeddings, without a model name in the interface — the
 * model is part of the adapter's configuration, so swapping vendors doesn't
 * touch plugin code. Tool use, vision and structured output are out of scope
 * for v1; they sit behind `raw()`.
 */
export type AiAdapter = Adapter & {
	complete(options: AiCompleteOptions): Promise<{ text: string; usage: AiUsage }>
	/** Incremental text. `usage` arrives on the final chunk. */
	stream(options: AiCompleteOptions): AsyncIterable<{ text: string; usage?: AiUsage }>
	embed(texts: string[]): Promise<{ vectors: number[][]; usage: AiUsage }>
}

const methods = ['complete', 'stream', 'embed'] as const

const _covered: AssertCovered<(typeof methods)[number], PluginMethods<AiAdapter>> = true

export const ai: CapabilityDescriptor = {
	id: 'ai',
	label: 'AI',
	description: 'Generate text and embeddings.',
	methods,
	server_only_methods: [],
	has_default_adapter: false
}
