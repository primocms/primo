<script lang="ts">
	import find from 'lodash/find'
  import { Router, Link, Route } from "svelte-routing";
	import { ax } from './utils'
	import { onMount, createEventDispatcher, setContext } from 'svelte'
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
  import modal from './stores/app/modal'

	export let data
	export let functions
	export let sites = []
	export let showDashboardLink = false
	export let role = 'developer'

	setContext('functions', functions)
	setContext('showDashboardLink', showDashboardLink)

	$: setContext('sites', sites)
	$: $editorViewDev = (role === 'developer') ? true : false
	$: $userRole = role

	$: dispatch('save', $allSites)

	$: allSites.set(sites)

	$: site.update(s => ({
		...s,
		...data
	}))

	$: symbols.set(data.symbols)

	$: setPage($pageId, $site)

	function setPage(pageId, site) {
		const currentPage = find(site.pages, ['id', pageId || 'index'])
		content.set(currentPage.content)
		pageData.update(s => ({
			...s, 
			...currentPage
		}))

		tailwind.setInitial()
	}


</script>


<Router>
	<Route path="/:pageId" let:params>
		<Page pageId={params.pageId} on:build on:signOut />
	</Route>
	<Route>
		<Page pageId={'index'} on:build on:signOut />
	</Route>
</Router>

<Modal />
