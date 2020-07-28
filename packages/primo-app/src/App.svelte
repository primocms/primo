<script lang="ts">
  import { Router, Link, Route } from "svelte-routing";
	import { ax, updateDataToCurrentVersion, getEmptyData } from 'utils'
	import { onMount, createEventDispatcher, setContext } from 'svelte'
	import Page from './screens/Page/Page.svelte'
  import Modal from '@modal'

	const dispatch = createEventDispatcher()

	import {domainInfo, site, symbols, tailwind} from '@stores/data'
	import {content} from '@stores/data/page'
  import {modal} from '@stores/app'

	export let data

	$: dispatch('save', $site)

	tailwind.setInitial()

	$: site.update(s => ({
		...data
	}))

</script>


<Router>
	<Route path="/:pageId" let:params>
		<Page pageId={params.pageId} on:build />
	</Route>
	<Route>
		<Page pageId={'index'} on:build />
	</Route>
</Router>

<Modal />

<style type="scss" global>
	@import "./home.bulma.scss";
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
</style>