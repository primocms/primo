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
	export let sites = []
	export let role = 'developer'

	export let saving = false
	$: $savingStore = saving

	setContext('functions', functions)

	$: setContext('sites', sites)
	$: $editorViewDev = (role === 'developer') ? true : false
	$: $userRole = role

	$: dispatch('save', $site)

	$: allSites.set(sites)

	$: site.update(s => ({
		...s,
		...data
	}))

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
	<Route path="/site/*route" let:params>
		<Page route={getPage(params.route)} on:build on:signOut />
	</Route>
</Router>

<Modal />
