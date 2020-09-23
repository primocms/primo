<script lang="ts">
	import find from 'lodash/find'
  import { Router, Route } from "svelte-routing";
	import { createEventDispatcher, setContext } from 'svelte'
	import Page from './views/editor/Page.svelte'
  import Modal from './views/modal/ModalContainer.svelte'

	const dispatch = createEventDispatcher()

	import { allSites} from './stores/data'
	import tailwind from './stores/data/tailwind'
	import site from './stores/data/site'
	import symbols from './stores/data/site/symbols'
	import pageData from './stores/data/pageData'
	import {pageId} from './stores/data/page'
	import content from './stores/data/page/content'
  import {editorViewDev, userRole} from './stores/app'
	import {saving as savingStore} from './stores/app/misc'

	export let data
	export let functions
	export let role = 'developer'
	export let saving = false
	$: $savingStore = saving

	setContext('functions', functions)

	$: $editorViewDev = (role === 'developer') ? true : false
	$: $userRole = role

	// set store from passed in data
	$: site.update(s => ({
		...s,
		...data
	}))

	// dispatch save when the site gets updated
	$: dispatch('save', $site)

	$: symbols.set(data.symbols)

	$: setPage($pageId, $site)

	function setPage(pageId, site) {
		const currentPage = find(site.pages, ['id', pageId])
		if (currentPage) {
			content.set(currentPage.content)
			pageData.update(s => ({
				...s, 
				...currentPage
			}))
		}

		tailwind.setInitial()
	}

	function getPage(route) {
		const page = route.split('/')[1]
		return page ? page : 'index'
	}

</script>

<Router>
	<Route path="/*route" let:params>
		<Page route={getPage(params.route)} on:build on:signOut />
	</Route>
</Router>

<Modal />
