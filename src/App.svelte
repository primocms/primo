<script lang="ts">
	import find from 'lodash/find'
  import { Router, Route } from "svelte-routing";
	import { createEventDispatcher, setContext } from 'svelte'
	import Page from './views/editor/Page.svelte'
  import Modal from './views/modal/ModalContainer.svelte'

	const dispatch = createEventDispatcher()

	import tailwind from './stores/data/tailwind'
	import {id as pageId} from './stores/app/activePage'
	import {content, styles, fields, dependencies, wrapper} from './stores/app/activePage'
  import {editorViewDev, userRole} from './stores/app'
	import {saving as savingStore} from './stores/app/misc'

	import {unsaved} from './stores/app/misc'
	import saved from './stores/data/saved'
	import {pages, site} from './stores/data/draft'
	import {hydrateSite} from './stores/actions'

	export let data
	export let functions
	export let role = 'developer'
	export let saving = false
	$: $savingStore = saving

	setContext('functions', functions)

	$: $editorViewDev = (role === 'developer') ? true : false
	$: $userRole = role

	$: hydrateSite(data)

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

		tailwind.setInitial()
	}

	function getPage(route) {
		let page
		if (route.includes('site')) {
			page = route.split('/')[2]
		} else {
			page = route
		}
		return page ? page : 'index'
	}

	function saveSite() {
		console.log('saved', saved.get())
		$unsaved = false
		dispatch('save', saved.get())
	}

</script>

<Router>
	<Route path="/*route" let:params>
		<Page route={getPage(params.route)} on:save={saveSite} on:build on:signOut />
	</Route>
</Router>

<Modal />
