<script lang="ts">
	import find from 'lodash/find'
  import { Router, Route } from "svelte-routing";
	import { createEventDispatcher, setContext } from 'svelte'
	import Page from './views/editor/Page.svelte'
  import Modal from './views/modal/ModalContainer.svelte'

	const dispatch = createEventDispatcher()

	import { allSites} from './stores/data'
	import tailwind from './stores/data/tailwind'
	import pageData from './stores/data/pageData'
	// import {pageId} from './stores/data/page'
	import {id as pageId} from './stores/app/activePage'
	import {content} from './stores/app/activePage'
  import {editorViewDev, userRole} from './stores/app'
	import {saving as savingStore} from './stores/app/misc'

	import saved from './stores/data/saved'
	import {pages} from './stores/data/draft'

	export let data
	export let functions
	export let role = 'developer'
	export let saving = false
	$: $savingStore = saving

	setContext('functions', functions)

	$: $editorViewDev = (role === 'developer') ? true : false
	$: $userRole = role

	$: saved.hydrate(data)

	$: setPageContent($pageId, $pages)
	function setPageContent(id, pages) {
		const currentPage = find(pages, ['id', id])
		if (currentPage) {
			content.set(currentPage.content)
		}

		tailwind.setInitial()
	}

	function getPage(route) {
		let page
		if (route.includes('site')) {
			page = route.split('/')[1]
		} else {
			page = route
		}
		return page ? page : 'index'
	}

	function saveSite() {
		console.log('saved', saved.get())
		dispatch('save', saved.get())
	}

</script>

<Router>
	<Route path="/*route" let:params>
		<Page route={getPage(params.route)} on:save={saveSite} on:build on:signOut />
	</Route>
</Router>

<Modal />
