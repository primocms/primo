<script>
  import { link } from "svelte-routing";
  import { onMount } from 'svelte'
  import { fade, slide } from 'svelte/transition'
	import Firestore from '@fb/firestore'
  import FirebaseAuth, {checkIfLoggedIn,signOutUser} from '@fb/auth'

  import { user } from '@stores/data'
  import { modal } from '@stores/app'

  function openAuth() {
    modal.show('AUTHENTICATION')
  }

  function openUserSettings() {
    modal.show('USER_SETTINGS')
  }

</script>

<Firestore />
<FirebaseAuth on:load={async () => {
  // checkIfLoggedIn()
}} />

<nav role="navigation" aria-label="main navigation">
  <a use:link href="/">
    <img class="logo" src="./symbol.svg" alt="primo logo"/>
  </a>
  <div class="flex"> 
    {#if $user.email}
      <button class="text-gray-700 text-xs mr-4 hover:text-gray-800 transition-colors duration-100" on:click={openUserSettings}>
        { $user.email }
      </button>
      <button class="text-xs rounded border-solid border-gray-300 border font-medium py-2 px-3 text-gray-600 hover:bg-gray-600 hover:text-white transition-colors duration-100" on:click={signOutUser}>Sign Out</button>
    {:else}
      <!-- <button class="auth-button text" on:click={() => openAuth('signup')}><span>Sign up</span></button> -->
      <button class="auth-button" on:click={openAuth}>
        <i class="fab fa-github mr-1"></i>
        Log in
      </button>
    {/if}
  </div>
</nav>

<style>

  .auth-button {
    @apply ml-4 font-bold py-2 px-4 text-gray-100 bg-primored rounded-lg inline-block transition-colors duration-200;
    will-change: background-color;
  }
  .auth-button:hover {
    @apply bg-gray-100 text-gray-800;
    i {
      @apply text-gray-800;
    }
  } 


  nav {
    /* max-width: 900px; */
    /* margin: 0 auto; */
    /* padding: 1rem; */
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .logo {
    width: 4rem;
  }

</style>