import { z } from 'zod'

export const Page = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	slug: z.string(),
	compiled_html: z.string().or(z.file()).optional(),
	compiled_html_hash: z.string().optional(),
	page_type: z.string().nonempty(),
	parent: z.string(),
	site: z.string().nonempty(),
	index: z.number().int().nonnegative()
})

export type Page = z.infer<typeof Page>
