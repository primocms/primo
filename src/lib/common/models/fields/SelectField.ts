import { FieldBase } from '../FieldBase'
import { z } from 'zod'
import { Condition } from '../Condition'

export const SelectField = FieldBase.extend({
	type: z.literal('select'),
	config: z
		.object({
			options: z
				.object({
					value: z.string(),
					label: z.string(),
					icon: z.string().optional()
				})
				.array(),
			condition: Condition.nullable().optional()
		})
		.nullable()
})

export type SelectField = z.infer<typeof SelectField>
