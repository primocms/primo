<script>
	import {find,some,isEqual} from 'lodash'
	import { router } from 'tinro'
	import Mousetrap from 'mousetrap'

	import { createEventDispatcher, onDestroy } from 'svelte'
	import Page from './views/editor/Page.svelte'
  import Modal from './views/modal/ModalContainer.svelte'
	import modal from './stores/app/modal'
	import * as modals from './views/modal'

	const dispatch = createEventDispatcher()

	import tailwind from './stores/data/tailwind'
	import {id as pageId} from './stores/app/activePage'
	import {content, styles, fields, wrapper} from './stores/app/activePage'
  import {switchEnabled, userRole} from './stores/app'
	import {saving as savingStore, showKeyHint, loadingSite} from './stores/app/misc'
	import {createSite} from './const'

	// import site from './stores/data/site'
	import {pages} from './stores/data/draft'
	import site from './stores/data/site'
	import {hydrateSite} from './stores/actions'

	export let data
	export let role = 'developer'
	export let saving = false
	$: $savingStore = saving

	$: $switchEnabled = (role === 'developer') ? true : false
	$: $userRole = role

	let cachedData
	$: if (!isEqual(cachedData, data)) {
		cachedData = data
		hydrateSite(data)
		tailwind.setInitial()
	}

	$: dispatch('save', $site)

	$: $pageId = getPageId($router.path)
	function getPageId(path) {
		const [ user, site, root, child ] = $router.path.substr(1).split('/')
		const final = child ? `${root}/${child}` : root || 'index'
		return final
	}

	$: setPageContent($pageId, $pages)
	function setPageContent(id, pages) {
		const [ root, child ] = id.split('/')
		const rootPage = find(pages, ['id', root || 'index']) 
		if (rootPage && !child) {
			setPageStore(rootPage)
		} else if (rootPage && child) {
			const childPage = find(rootPage.pages, ['id', id])
			setPageStore(childPage)
		} else {
			console.warn('Could not navigate to page', id)
		}

		function setPageStore(page) {
			content.set(page.content)
			styles.set(page.styles)
			fields.set(page.fields)
			wrapper.set(page.wrapper)
		}
	}

	$: activeModal = getActiveModal($modal.type)
	function getActiveModal(modalType) {
		return modalType ? {
			'SITE_PAGES' : modals.SitePages,
			'COMPONENT_EDITOR' : modals.ComponentEditor,
			'SYMBOL_LIBRARY' : modals.SymbolLibrary,
			'FIELDS' : modals.Fields,
			'WRAPPER' : modals.HTML,
			'STYLES' : modals.CSS
		}[modalType] || $modal.component : null
	}

  Mousetrap.bind('command', () => $showKeyHint = true, 'keydown');
  Mousetrap.bind('command', () => $showKeyHint = false, 'keyup');

	$: $loadingSite = checkFor404($pageId, $pages)
	function checkFor404(id, pages) {
		const [ root, child ] = id.split('/')
		const exists = some(pages, ['id',root]) || some(pages, ['id',child])
		return !exists
	}

	onDestroy(() => {
		dispatch('destroy')
	})

</script>  

<Page />

<Modal visible={!!activeModal}>
	<svelte:component this={activeModal} {...$modal.componentProps} />
</Modal>
