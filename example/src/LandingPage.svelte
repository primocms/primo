<script>
	import { onMount, onDestroy } from 'svelte'
  import { Router, Link, Route } from "svelte-routing";
	import Home from './screens/Home/Home.svelte'
	import Dashboard from './screens/Dashboard/Dashboard.svelte'
  import Modal from './@modal'
  import SiteFooter from './screens/Home/SiteFooter.svelte'
	import SignInNav from './screens/Home/SignInNav.svelte'

  import { domainInfo, user, modal } from './stores'

	export let collab = null

  if (collab) {
    modal.show('COLLABORATE', collab)
  }

</script>

{#if $user.email}
  <div class="home-container">
    <SignInNav />
    <Dashboard /> 
    <SiteFooter variants="on-light my-3 text-xs" />
  </div>
{:else}
  <Home />
{/if}

<style>
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  .home-container {
    /* min-height: 94vh; */
		@apply max-w-2xl pt-4 mt-0 w-full px-8 mx-auto;
  }

</style>

<svelte:head>
  <title>primo</title>
</svelte:head>