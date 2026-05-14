import { z } from 'zod'
import { Site } from './Site'
import { SiteUpload } from './SiteUpload'
import { SiteField } from './SiteField'
import { SiteEntry } from './SiteEntry'
import { SiteSymbol } from './SiteSymbol'
import { SiteSymbolField } from './SiteSymbolField'
import { SiteSymbolEntry } from './SiteSymbolEntry'
import { PageType } from './PageType'
import { PageTypeField } from './PageTypeField'
import { PageTypeEntry } from './PageTypeEntry'
import { PageTypeSymbol } from './PageTypeSymbol'
import { PageTypeSectionEntry } from './PageTypeSectionEntry'
import { Page } from './Page'
import { PageEntry } from './PageEntry'
import { PageSection } from './PageSection'
import { PageSectionEntry } from './PageSectionEntry'
import { PageTypeSection } from './PageTypeSection'

type FileEntry = {
	name: string
	size: number
}

/**
 * File signature for snapshot file. Kept as the legacy "PALACMS:3.0" magic
 * bytes so existing .pala / .primo files round-trip across the rebrand. The
 * bytes are an on-disk identifier, not a user-visible brand string.
 */
const SIGNATURE = new Uint8Array([0x50, 0x41, 0x4c, 0x41, 0x43, 0x4d, 0x53, 0x3a, 0x33, 0x2e, 0x30])
const FILE_COLLECTIONS = ['site_uploads']

export const Snapshot = z.codec(
	z.file(),
	z.object({
		metadata: z.object({
			created_at: z.iso.datetime(),
			source_instance_id: z.string(),
			source_instance_version: z.string()
		}),
		records: z.object({
			sites: Site.omit({ preview: true }).array(),
			site_uploads: SiteUpload.omit({ file: true }).extend({ file: z.file() }).array(),
			site_fields: SiteField.array(),
			site_entries: SiteEntry.array(),
			site_symbols: SiteSymbol.omit({ compiled_js: true }).array(),
			site_symbol_fields: SiteSymbolField.array(),
			site_symbol_entries: SiteSymbolEntry.array(),
			page_types: PageType.array(),
			page_type_fields: PageTypeField.array(),
			page_type_entries: PageTypeEntry.array(),
			page_type_symbols: PageTypeSymbol.array(),
			page_type_sections: PageTypeSection.array(),
			page_type_section_entries: PageTypeSectionEntry.array(),
			pages: Page.omit({ compiled_html: true }).array(),
			page_entries: PageEntry.array(),
			page_sections: PageSection.array(),
			page_section_entries: PageSectionEntry.array()
		})
	}),
	{
		decode: async (file) => {
			const buffer = await file.arrayBuffer()
			let head = 0

			// Check file signature
			const signature = new Uint8Array(buffer.slice(0, SIGNATURE.byteLength))
			for (; head < SIGNATURE.length; head++) {
				if (signature[head] !== SIGNATURE[head]) {
					throw new Error('Invalid snapshot file signature')
				}
			}

			const header_size = 4 * 4
			const header = new Uint32Array(buffer.slice(head, head + header_size))
			head += header_size

			const metadata_size = header[0]
			const metadata = decodeJson(buffer.slice(head, head + metadata_size))
			head += metadata_size

			const records_size = header[1]
			const records = decodeJson(buffer.slice(head, head + records_size))
			head += records_size

			const filemeta_size = header[2]
			const filemeta = decodeJson(buffer.slice(head, head + filemeta_size)) as FileEntry[]
			head += filemeta_size

			const files = filemeta.map(({ name, size }) => {
				const file = new File([buffer.slice(head, head + size)], name)
				head += size
				return file
			})
			for (const collection of FILE_COLLECTIONS) {
				for (const record of records[collection]) {
					record.file = files[record.file]
				}
			}

			return { metadata, records, files }
		},
		encode: (snapshot) => {
			const files: File[] = FILE_COLLECTIONS.flatMap((collection) => snapshot.records[collection].map(({ file }) => file))
			const file_entries: FileEntry[] = files.map(({ name, size }) => ({ name, size }))
			const filemeta = toJsonBlob(file_entries)
			const filedata = new Blob(files)

			// Replace file values with index numbers that they appear at in the snapshot file
			const file_records = Object.fromEntries(
				FILE_COLLECTIONS.map((collection) => [collection, snapshot.records[collection].map((record: { file: File }) => ({ ...record, file: files.indexOf(record.file) }))])
			)

			const metadata = toJsonBlob(snapshot.metadata)
			const records = toJsonBlob({
				...snapshot.records,
				...file_records
			})

			const data_segements = [metadata, records, filemeta, filedata]
			const header = new Uint32Array(data_segements.map((segment) => segment.size))
			const data = new Blob(data_segements)
			const file = new File([SIGNATURE, header, data], 'snapshot.bin')
			return file
		}
	}
)

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const toJsonBlob = (data: unknown) => new Blob([textEncoder.encode(JSON.stringify(data))])
const decodeJson = (data: ArrayBufferLike) => JSON.parse(textDecoder.decode(data))

export type Snapshot = z.infer<typeof Snapshot>
