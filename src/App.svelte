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
	<Route path="/*id" let:params>
		<Page pageId={params.id === '' ? 'index' : params.id} on:build on:signOut />
	</Route>
</Router>

<Modal />
