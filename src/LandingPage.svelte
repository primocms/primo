<script lang="ts">
  import { Router, Link, Route } from "svelte-routing";
	import { ax, updateDataToCurrentVersion, getEmptyData } from 'utils'
	import { onMount, onDestroy } from 'svelte'
	import SignInNav from './screens/Home/SignInNav.svelte'
	import Home from './screens/Home/Home.svelte'
	import Firebase from '@fb'
	import { setPage } from '@fb/firestore/domains'
	import Dashboard from './screens/Dashboard/Dashboard.svelte'
	import Page from './screens/Page/Page.svelte'
  import Modal from '@modal'
  import SiteFooter from './screens/Home/SiteFooter.svelte'

  import { domainInfo, user } from '@stores/data'
  import {modal,onDashboard} from '@stores/app'

	export let collab : boolean = null

	onMount(async () => {
    onDashboard.set(true)
		domainInfo.save({onDev: window.location.href.includes('localhost')})
	})

  onDestroy(() => {
    onDashboard.set(false)
  })

  if (collab) {
    modal.show('COLLABORATE', collab)
  }

</script>

<Firebase />


<Router>
  <Route path="/">
    <div class="home-container md:px-0">
      <SignInNav />
      {#if $user.email}
        <Dashboard /> 
      {:else}
        <Home>
          <SiteFooter />
        </Home>  
      {/if}
    </div>
  </Route>
  <div class="container max-w-2xl">
    <Route path="/about">
      <div class="min-h-screen flex flex-col justify-center w-full py-3 text-gray-500 bg-codeblack">
        <SignInNav />
        This is the about page
      </div>
      <SiteFooter />
    </Route>
    <Route path="/pricing">
      <div class="min-h-screen flex flex-col justify-center w-full py-3 text-gray-500 bg-codeblack">
        <SignInNav />
        This is the pricing page
      </div>
      <SiteFooter />
    </Route>
  </div>
</Router>


<Modal />

<style type="scss" global>
	@import "./home.bulma.scss";
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  .home-container {
    /* min-height: 94vh; */
		@apply max-w-2xl pt-4 mt-0 w-full px-8 mx-auto;
  }

</style>