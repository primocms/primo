<script lang="ts">
	import { find } from 'lodash'
  import { Router, Link, Route } from "svelte-routing";
	import { ax, updateDataToCurrentVersion, getEmptyData } from 'utils'
	import { onMount, createEventDispatcher, setContext } from 'svelte'
	import Page from './screens/Page/Page.svelte'
  import Modal from '@modal'

	const dispatch = createEventDispatcher()

	import {domainInfo, site, symbols, tailwind, pageData} from '@stores/data'
	import {content,pageId} from '@stores/data/page'
  import {modal} from '@stores/app'

	export let data

	$: dispatch('save', $site)

	$: {
		site.update(s => ({
			...s,
			...data
		}))

		const currentPage = find($site.pages, ['id', $pageId || 'index'])
		pageData.update(s => ({
			...s, 
			...currentPage
		}))

		tailwind.setInitial()
	}

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