<script lang="ts">
	import {find} from 'lodash'
	import queryParser from "query-string";

	import Router, {location,querystring} from 'svelte-spa-router'
	import {wrap} from 'svelte-spa-router/wrap'

	import { createEventDispatcher, setContext } from 'svelte'
	import Page from './views/editor/Page.svelte'
  import Modal from './views/modal/ModalContainer.svelte'
	import modal from './stores/app/modal'
	import * as modals from './views/modal'

	const dispatch = createEventDispatcher()

	import tailwind from './stores/data/tailwind'
	import {id as pageId} from './stores/app/activePage'
	import {content, styles, fields, dependencies, wrapper} from './stores/app/activePage'
  import {editorViewDev, userRole} from './stores/app'
	import {saving as savingStore} from './stores/app/misc'

	import {unsaved} from './stores/app/misc'
	import site from './stores/data/site'
	import {pages} from './stores/data/draft'
	import {hydrateSite} from './stores/actions'

	export let data
	export let functions
	export let role = 'developer'
	export let saving = false
	$: $savingStore = saving

	// setContext('functions', functions)

	$: $editorViewDev = (role === 'developer') ? true : false
	$: $userRole = role

	$: {
		hydrateSite(data)
		tailwind.setInitial()
	}

	$: dispatch('save', $site)

	$: $pageId = $location.substr(1) || 'index'
	$: setPageContent($pageId, $pages)
	function setPageContent(id, pages) {
		const currentPage = find(pages, ['id', id])
		if (currentPage) {
			content.set(currentPage.content)
			styles.set(currentPage.styles)
			fields.set(currentPage.fields)
			dependencies.set(currentPage.dependencies)
			wrapper.set(currentPage.wrapper)
		}
	}

	$: activeModal = getActiveModal($querystring)
	function getActiveModal(query) {
		const { m:type } = queryParser.parse(query)
		return type ? {
			'pages' : modals.SitePages,
			'component' : modals.ComponentEditor,
			'symbols' : modals.SymbolLibrary,
			'sections' : modals.PageSections,
			'fields' : modals.Fields,
			'dependencies' : modals.Dependencies,
			'html' : modals.HTML,
			'css' : modals.CSS,
			'release-notes' : modals.ReleaseNotes,
		}[type] || $modal.component : null
	}

</script>

<Router routes={{ '/:page?': Page }} />

<Modal visible={!!activeModal}>
	<svelte:component this={activeModal} {...$modal.componentProps} />
</Modal>
