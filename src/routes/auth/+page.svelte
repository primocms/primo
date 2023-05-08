<script>
  import { page } from '$app/stores'
  import { fade } from 'svelte/transition'
  import SignIn from './SignIn.svelte'
  import SignUp from './SignUp.svelte'
  import ServerLogo from '$lib/ui/ServerLogo.svelte'

  export let form

  let email = $page.url.searchParams.get('email') || ''
  let password = ''

  $: error = form?.error

  $: signing_in = $page.url.searchParams.has('signup') ? false : true
</script>

{#key signing_in}
  <main in:fade class="primo-reset">
    <div class="left">
      <div class="logo">
        <div class="logo-container">
          <ServerLogo />
        </div>
      </div>
      <div class="box">
        <header>
          <!-- <img src={logo_dark} alt="breely logo" /> -->
          <h1>{signing_in ? 'Sign in' : 'Sign Up'}</h1>
          {#if !signing_in}
            <p>
              Welcome to your new Primo server! Enter an email address and
              password below you'll use to administrate this server.
            </p>
          {/if}
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
  .logo {
    display: flex;
    justify-content: center;
    width: 100%;
    margin-bottom: 2rem;

    .logo-container {
      width: 10rem;
    }
  }
  header {
    /* img {
      padding-bottom: 40px;
    } */
    h1 {
      text-align: left;
      font-weight: 500;
      font-size: 24px;
      line-height: 24px;
      padding-bottom: 1rem;
      /* --typography-spacing-vertical: 1rem; */
    }
    p {
      color: var(--color-gray-3);
      padding-bottom: 1.5rem;
    }
  }
  .error {
    color: #f72228;
    margin-bottom: 1rem;
  }
  .left {
    padding: 3rem clamp(3rem, 10vw, 160px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .box {
    width: 100%;
    max-width: 450px;
    padding: 2.5rem;
    border-radius: 6px;
    background-color: #1a1a1a;
  }
</style>
