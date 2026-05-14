import { z } from 'zod'
import { locales } from '../constants'

export const Entry = z.object({
	id: z.string().nonempty(),
	locale: z.enum(locales).or(z.string()).catch('en'),
	value: z.any(),
	field: z.string().nonempty(),
	parent: z.string().optional(),
	index: z.number().int().nonnegative()
})

export type Entry = z.infer<typeof Entry>
