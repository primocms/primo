<script lang="ts">
  import { Router, Link, Route } from "svelte-routing";
	import { ax, updateDataToCurrentVersion, getEmptyData } from 'utils'
	import { onMount, createEventDispatcher } from 'svelte'
	import SignInNav from './screens/Home/SignInNav.svelte'
	import Home from './screens/Home/Home.svelte'
	import Firebase from '@fb'
	import { setPage } from '@fb/firestore/domains'
	import Dashboard from './screens/Dashboard/Dashboard.svelte'
	import Page from './screens/Page/Page.svelte'
  import Modal from '@modal'

	const dispatch = createEventDispatcher()

	import {domainInfo, content, site, symbols} from '@stores/data'
  import {modal,onDashboard} from '@stores/app'


	export let data
	
	let siteData = data.site;
	let symbolData = data.symbols;

	export let isPrimoHomepage:boolean = false
	export let action:string = null
	export let subdomain:string = ''

	$: domainInfo.save({domainName: subdomain})

	$: onDashboard.set(isPrimoHomepage)

	domainInfo.save({
		onDev: window.location.href.includes('localhost')
	})

	if (action === 'collab') {
		modal.show('COLLABORATE')
	}

	function dispatchSave() {
		dispatch('save', {
			site: $site,
			symbols: $symbols
		})
	}

</script>


<Router>
	<Route path="/:pageId" let:params>
		<Page pageId={params.pageId} {siteData} {symbolData} on:save={dispatchSave} />
	</Route>
	<Route>
		<Page pageId={'index'} {siteData} {symbolData} on:save={dispatchSave} />
	</Route>
</Router>

<Modal />

<style type="scss" global>
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
</style>