import {
	// Deploy,
	SectionEditor,
	BlockEditor,
	SiteEditor,
	PageEditor,
	SitePages,
	Dialog,
	BlockPicker
} from '../../views/modal'

export const modalTypes = {
	// DEPLOY: {
	// 	component: Deploy,
	// 	header: {
	// 		title: 'Deploy',
	// 		icon: 'fas fa-cloud-upload-alt'
	// 	}
	// },
	SECTION_EDITOR: {
		component: SectionEditor,
		header: {
			title: 'Create Component',
			icon: 'fas fa-code'
		}
	},
	BLOCK_EDITOR: {
		component: BlockEditor,
		header: {
			title: 'Create Symbol',
			icon: 'fas fa-code'
		}
	},
	PAGE_EDITOR: {
		component: PageEditor,
		header: {
			title: 'Edit Page',
			icon: 'fas fa-code'
		}
	},
	SITE_EDITOR: {
		component: SiteEditor,
		header: {
			title: 'Edit Page',
			icon: 'fas fa-code'
		}
	},
	SITE_PAGES: {
		component: SitePages,
		header: {
			title: 'Pages',
			icon: 'fas fa-th-large'
		}
	},
	DIALOG: {
		component: Dialog
	},
	BLOCK_PICKER: {
		component: BlockPicker
	}
}
