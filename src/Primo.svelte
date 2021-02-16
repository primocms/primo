
<script lang="ts">
	import {find} from 'lodash'
	import { router } from 'tinro'

	import { createEventDispatcher } from 'svelte'
	import Page from './views/editor/Page.svelte'
  import Modal from './views/modal/ModalContainer.svelte'
	import modal from './stores/app/modal'
	import * as modals from './views/modal'

	const dispatch = createEventDispatcher()

	import tailwind from './stores/data/tailwind'
	import {id as pageId} from './stores/app/activePage'
	import {content, styles, fields, dependencies, wrapper} from './stores/app/activePage'
  import {switchEnabled, userRole} from './stores/app'
	import {saving as savingStore} from './stores/app/misc'
	import {createSite} from './const'

	import site from './stores/data/site'
	import {pages} from './stores/data/draft'
	import {hydrateSite} from './stores/actions'

	export let data = createSite()
	export let role = 'developer'
	export let saving = false
	$: $savingStore = saving

	$: $switchEnabled = (role === 'developer') ? true : false
	$: $userRole = role

	$: {
		hydrateSite(data)
		tailwind.setInitial()
	}

	$: dispatch('save', $site)

	$: $pageId = $router.path.substr(1) || 'index'
	$: setPageContent($pageId, $pages)
	function setPageContent(id, pages) {
		const [ user, repo, root, child ] = id.split('/')
		const rootPage = find(pages, ['id', root || 'index']) 
		if (rootPage && !child) {
			setPageStore(rootPage)
		} else if (rootPage && child) {
			console.log({rootPage}, child)
			const childPage = find(rootPage.pages, ['id', `${root}/${child}`])
			console.log({childPage})
			setPageStore(childPage)
		} else {
			console.warn('Could not navigate to page', id)
		}

		function setPageStore(page) {
			content.set(page.content)
			styles.set(page.styles)
			fields.set(page.fields)
			dependencies.set(page.dependencies)
			wrapper.set(page.wrapper)
		}
	}

	$: activeModal = getActiveModal($modal.type)
	function getActiveModal(modalType) {
		return modalType ? {
			'SITE_PAGES' : modals.SitePages,
			'COMPONENT_EDITOR' : modals.ComponentEditor,
			'COMPONENT_LIBRARY' : modals.SymbolLibrary,
			'PAGE_SECTIONS' : modals.PageSections,
			'FIELDS' : modals.Fields,
			'DEPENDENCIES' : modals.Dependencies,
			'WRAPPER' : modals.HTML,
			'STYLES' : modals.CSS,
			'RELEASE_NOTES' : modals.ReleaseNotes,
		}[modalType] || $modal.component : null
	}

</script>  

<Page />

<Modal visible={!!activeModal}>
	<svelte:component this={activeModal} {...$modal.componentProps} />
</Modal>
