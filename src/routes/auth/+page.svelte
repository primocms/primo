<script>
  // import { browser } from '$app/environment';
  import { page } from '$app/stores'
  import { fade } from 'svelte/transition'
  import SignIn from './SignIn.svelte'
  import SignUp from './SignUp.svelte'
  import logo_dark from '$lib/assets/logodark.svg'
  // import logo_light from '$lib/assets/breezlywhite.svg';

  export let form

  let email = $page.url.searchParams.get('email') || ''
  let password = ''

  let error = form?.error

  let signing_in = $page.url.searchParams.has('signup') ? false : true
</script>

{#key signing_in}
  <main in:fade class="primo-reset">
    <div class="left">
      <header>
        <!-- <img src={logo_dark} alt="breely logo" /> -->
        <h1>{signing_in ? 'Sign in' : 'Sign Up'}</h1>
      </header>
      {#if error}
        <div class="error">{error}</div>
      {/if}
      {#if signing_in}
        <SignIn
          bind:email
          bind:password
          on:switch={() => (signing_in = false)}
        />
      {:else}
        <SignUp
          bind:email
          bind:password
          on:switch={() => (signing_in = true)}
        />
      {/if}
    </div>
    <!-- <div class="right" /> -->
  </main>
{/key}

<style lang="postcss">
  main {
    display: grid;
    /* grid-template-columns: 1fr 1fr; */
    min-height: 100vh;
    background: var(--color-gray-9);
    color: white;
  }
  header {
    padding-bottom: 10px;
    /* img {
      padding-bottom: 40px;
    } */
    h1 {
      font-weight: 700;
      font-size: 40px;
      line-height: 24px;
      padding-bottom: 2rem;
      /* --typography-spacing-vertical: 1rem; */
    }
  }
  .error {
    padding: 1.5rem;
    border-radius: 0.25rem;
    background: #eee;
    margin: 20px 0;
  }
  .left {
    padding: 3rem clamp(3rem, 10vw, 160px);
    display: grid;
    place-content: center;
  }
  /* .right {
		background: #1D5FFC;
	} */
</style>
