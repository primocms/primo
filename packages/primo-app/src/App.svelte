<script lang="ts">
  import { Router, Link, Route } from "svelte-routing";
	import { ax, updateDataToCurrentVersion, getEmptyData } from 'utils'
	import { onMount, createEventDispatcher, setContext } from 'svelte'
	import Page from './screens/Page/Page.svelte'
  import Modal from '@modal'

	const dispatch = createEventDispatcher()

	import {domainInfo, content, site, symbols} from '@stores/data'
  import {modal} from '@stores/app'

	export let data

	$: dispatch('save', $site)

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
	@import "./home.bulma.scss";
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
</style>