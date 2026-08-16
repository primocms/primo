import { z } from 'zod'

export const Site = z.object({
	id: z.string().nonempty(),
	name: z.string().nonempty(),
	description: z.string(),
	host: z.string().nonempty(),
	group: z.string().nonempty(),
	head: z.string(),
	foot: z.string(),
	preview: z.string().or(z.file()).optional(),
	index: z.number().int().nonnegative(),
	// Custom-domain connection state (see internal/domain_provider.go). Optional
	// so older records / non-hosted instances validate without them.
	// domain_dns_records is a JSON column: PocketBase returns it parsed (array),
	// so it's typed loosely like other JSON fields (config, entry value).
	domain_status: z.string().optional(),
	domain_dns_records: z.any().optional(),
	domain_provider_id: z.string().optional(),
	domain_error: z.string().optional()
})

export type Site = z.infer<typeof Site>
