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

	$: dispatch('save', $site)
	// reactively dispatch 'save' when $site changes
	// next: dispatch save when saving component library

</script>


<Router>
	<Route path="/:pageId" let:params>
		<Page pageId={params.pageId} {data} />
	</Route>
	<Route>
		<Page pageId={'index'} {data} />
	</Route>
</Router>

<Modal />

<style type="scss" global>
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
</style>