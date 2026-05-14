import { Collaborator } from '$lib/common/models/Collaborator'
import { LibrarySymbol } from '$lib/common/models/LibrarySymbol'
import { LibrarySymbolEntry } from '$lib/common/models/LibrarySymbolEntry'
import { LibrarySymbolField } from '$lib/common/models/LibrarySymbolField'
import { LibrarySymbolGroup } from '$lib/common/models/LibrarySymbolGroup'
import { LibraryUpload } from '$lib/common/models/LibraryUpload'
import { Page } from '$lib/common/models/Page'
import { PageEntry } from '$lib/common/models/PageEntry'
import { PageSection } from '$lib/common/models/PageSection'
import { PageSectionEntry } from '$lib/common/models/PageSectionEntry'
import { PageType } from '$lib/common/models/PageType'
import { PageTypeEntry } from '$lib/common/models/PageTypeEntry'
import { PageTypeField } from '$lib/common/models/PageTypeField'
import { PageTypeSection } from '$lib/common/models/PageTypeSection'
import { PageTypeSectionEntry } from '$lib/common/models/PageTypeSectionEntry'
import { PageTypeSymbol } from '$lib/common/models/PageTypeSymbol'
import { Site } from '$lib/common/models/Site'
import { SiteEntry } from '$lib/common/models/SiteEntry'
import { SiteField } from '$lib/common/models/SiteField'
import { SiteGroup } from '$lib/common/models/SiteGroup'
import { SiteRoleAssignment } from '$lib/common/models/SiteRoleAssignment'
import { SiteSnapshot } from '$lib/common/models/SiteSnapshot'
import { SiteSymbol } from '$lib/common/models/SiteSymbol'
import { SiteSymbolEntry } from '$lib/common/models/SiteSymbolEntry'
import { SiteSymbolField } from '$lib/common/models/SiteSymbolField'
import { SiteUpload } from '$lib/common/models/SiteUpload'
import { User } from '$lib/common/models/User'
import { UserActivity } from '$lib/common/models/UserActivity'
import { createCollectionMapping } from './CollectionMapping.svelte'
import { activity, self } from './managers'

const is_local_dev =
	typeof location !== 'undefined' &&
	(location.hostname === 'localhost' ||
		location.hostname === '127.0.0.1' ||
		location.hostname.endsWith('.localhost'))

const enable_subscriptions = !is_local_dev

export const Users = createCollectionMapping('users', User, self, {
	subscribe: enable_subscriptions,
	links: {
		site_groups() {
			return SiteGroups.list()
		},
		site_role_assignments() {
			return SiteRoleAssignments.list({ filter: { user: this.id } })
		}
	}
})

export const Collaborators = createCollectionMapping('collaborators', Collaborator, self, {
	subscribe: enable_subscriptions
})

export const LibrarySymbolGroups = createCollectionMapping('library_symbol_groups', LibrarySymbolGroup, self, {
	subscribe: enable_subscriptions,
	links: {
		symbols() {
			return LibrarySymbols.from(this.collection.manager).list({ filter: { group: this.id } })
		}
	}
})

export const LibrarySymbols = createCollectionMapping('library_symbols', LibrarySymbol, self, {
	subscribe: enable_subscriptions,
	links: {
		fields() {
			return LibrarySymbolFields.from(this.collection.manager).list({ filter: { symbol: this.id } })
		},
		entries() {
			const fields = LibrarySymbolFields.from(this.collection.manager).list({ filter: { symbol: this.id } })
			if (!fields) {
				return fields
			}

			const entries = fields.map((field) => LibrarySymbolEntries.from(this.collection.manager).list({ filter: { field: field.id } }))
			if (entries.some((entry) => entry === null)) {
				return null
			}
			if (entries.some((entry) => !entry)) {
				return undefined
			}

			return entries.filter((entry) => !!entry).flat()
		}
	}
})

export const LibrarySymbolFields = createCollectionMapping('library_symbol_fields', LibrarySymbolField, self, {
	subscribe: enable_subscriptions,
	links: {
		entries() {
			return LibrarySymbolEntries.from(this.collection.manager).list({ filter: { field: this.id } })
		}
	}
})

export const LibrarySymbolEntries = createCollectionMapping('library_symbol_entries', LibrarySymbolEntry, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const LibraryUploads = createCollectionMapping('library_uploads', LibraryUpload, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const SiteGroups = createCollectionMapping('site_groups', SiteGroup, self, {
	subscribe: enable_subscriptions,
	links: {
		sites() {
			return Sites.from(this.collection.manager).list({ filter: { group: this.id } })
		}
	}
})

export const Sites = createCollectionMapping('sites', Site, self, {
	subscribe: enable_subscriptions,
	links: {
		role_assignments() {
			return SiteRoleAssignments.from(this.collection.manager).list({ filter: { site: this.id } })
		},
		symbols() {
			return SiteSymbols.from(this.collection.manager).list({ filter: { site: this.id }, sort: '-created' })
		},
		fields() {
			return SiteFields.from(this.collection.manager).list({ filter: { site: this.id } })
		},
		entries() {
			return SiteEntries.from(this.collection.manager).list({ filter: { 'field.site': this.id } })
		},
		uploads() {
			return SiteUploads.from(this.collection.manager).list({ filter: { site: this.id } })
		},
		page_types() {
			// Sort by creation time ascending so newly created types appear at the bottom
			return PageTypes.from(this.collection.manager).list({ filter: { site: this.id }, sort: 'created' })
		},
		pages() {
			return Pages.from(this.collection.manager).list({ filter: { site: this.id } })
		},
		homepage() {
			return Pages.from(this.collection.manager).list({ filter: { site: this.id, parent: '' } })?.[0]
		}
	}
})

export const SiteRoleAssignments = createCollectionMapping('site_role_assignments', SiteRoleAssignment, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const SiteFields = createCollectionMapping('site_fields', SiteField, self, {
	subscribe: enable_subscriptions,
	links: {
		entries() {
			return SiteEntries.from(this.collection.manager).list({ filter: { field: this.id } })
		}
	}
})

export const SiteEntries = createCollectionMapping('site_entries', SiteEntry, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const SiteSymbols = createCollectionMapping('site_symbols', SiteSymbol, self, {
	subscribe: enable_subscriptions,
	links: {
		fields() {
			return SiteSymbolFields.from(this.collection.manager).list({ filter: { symbol: this.id } })
		},
		entries() {
			const fields = SiteSymbolFields.from(this.collection.manager).list({ filter: { symbol: this.id } })
			if (!fields) {
				return fields
			}

			const entries = fields.map((field) => SiteSymbolEntries.from(this.collection.manager).list({ filter: { field: field.id } }))
			if (entries.some((entry) => entry === null)) {
				return null
			}
			if (entries.some((entry) => !entry)) {
				return undefined
			}

			return entries.filter((entry) => !!entry).flat()
		}
	}
})

export const SiteSymbolFields = createCollectionMapping('site_symbol_fields', SiteSymbolField, self, {
	subscribe: enable_subscriptions,
	links: {
		entries() {
			return SiteSymbolEntries.from(this.collection.manager).list({ filter: { field: this.id } })
		}
	}
})

export const SiteSymbolEntries = createCollectionMapping('site_symbol_entries', SiteSymbolEntry, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const PageTypes = createCollectionMapping('page_types', PageType, self, {
	subscribe: enable_subscriptions,
	links: {
		symbols() {
			return PageTypeSymbols.from(this.collection.manager).list({ filter: { page_type: this.id } })
		},
		sections() {
			return PageTypeSections.from(this.collection.manager).list({ filter: { page_type: this.id } })
		},
		fields() {
			return PageTypeFields.from(this.collection.manager).list({ filter: { page_type: this.id } })
		},
		entries() {
			const fields = PageTypeFields.from(this.collection.manager).list({ filter: { page_type: this.id } })
			if (!fields) {
				return fields
			}

			const entries = fields.map((field) => PageTypeEntries.from(this.collection.manager).list({ filter: { field: field.id } }))
			if (entries.some((entry) => entry === null)) {
				return null
			}
			if (entries.some((entry) => !entry)) {
				return undefined
			}

			return entries.filter((entry) => !!entry).flat()
		}
	}
})

export const PageTypeFields = createCollectionMapping('page_type_fields', PageTypeField, self, {
	subscribe: enable_subscriptions,
	links: {
		entries() {
			return PageTypeEntries.from(this.collection.manager).list({ filter: { field: this.id } })
		}
	}
})

export const PageTypeEntries = createCollectionMapping('page_type_entries', PageTypeEntry, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const PageTypeSymbols = createCollectionMapping('page_type_symbols', PageTypeSymbol, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const PageTypeSections = createCollectionMapping('page_type_sections', PageTypeSection, self, {
	subscribe: enable_subscriptions,
	links: {
		entries() {
			return PageTypeSectionEntries.from(this.collection.manager).list({ filter: { section: this.id } })
		}
	}
})

export const PageTypeSectionEntries = createCollectionMapping('page_type_section_entries', PageTypeSectionEntry, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const Pages = createCollectionMapping('pages', Page, self, {
	subscribe: enable_subscriptions,
	links: {
		children() {
			return this.collection.list({ filter: { parent: this.id } })?.sort((a, b) => (a.index || 0) - (b.index || 0))
		},
		sections() {
			return PageSections.from(this.collection.manager)
				.list({ filter: { page: this.id } })
				?.sort((a, b) => a.index - b.index)
		},
		entries() {
			return PageEntries.from(this.collection.manager).list({ filter: { page: this.id } })
		}
	}
})

export const PageEntries = createCollectionMapping('page_entries', PageEntry, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const PageSections = createCollectionMapping('page_sections', PageSection, self, {
	subscribe: enable_subscriptions,
	links: {
		entries() {
			return PageSectionEntries.from(this.collection.manager).list({ filter: { section: this.id } })
		}
	}
})

export const PageSectionEntries = createCollectionMapping('page_section_entries', PageSectionEntry, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const SiteUploads = createCollectionMapping('site_uploads', SiteUpload, self, {
	subscribe: enable_subscriptions,
	links: {}
})

export const SiteSnapshots = createCollectionMapping('site_snapshots', SiteSnapshot, self, {
	subscribe: false,
	links: {}
})

export const UserActivities = createCollectionMapping('user_activities', UserActivity, activity, {
	subscribe: enable_subscriptions,
	links: {}
})
