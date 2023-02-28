<script>
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import axios from 'axios'
  import auth from '../../../supabase/auth'
  import { users } from '../../../supabase/db'
  import * as actions from '../../../actions'
  import { createUser } from '../../../supabase/helpers'
  import { page } from '$app/stores'
  import { browser } from '$app/environment'

  import Spinner from '$lib/ui/Spinner.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { config } from '../../../stores'
  import user from '../../../stores/user'
  import { sitePassword } from '../../../stores/misc'

  export let onSignIn = () => {}

  let loading = true
  if (browser) {
    axios
      .get('/api/auth')
      .then(({ data }) => {
        loading = false
        if (!data.initialized) {
          signingUp = true
          smallMessage = `Welcome to your new Primo Server! Enter the email address & password you'll use to administrate this server`
        }
      })
      .catch((e) => {
        console.log({ e })
        largeMessage = `Could not connect to your Supabase instance. Ensure you've followed the setup directions in the <a style="text-decoration:underline" href="https://github.com/primo-af/primo/tree/master/server">Primo Server repo</a>.`
      })
  }

  let collaboratorRole = $page.url.searchParams.get('role')
  $sitePassword = $page.url.searchParams.get('password')

  $: newSignup = $page.url.searchParams.get('signup') === ''
  $: invitationKey = $page.url.searchParams.get('key')
  $: newSignup && invitationKey && signUpWithPassword()
  $: if (newSignup && $sitePassword) {
    signingUp = true
    headerMessage = `You've been invited to collaborate on this site. Sign up to continue.`
  }

  $: if ($user.signedIn) {
    onSignIn()
  }

  async function signUpWithPassword() {
    smallMessage = `You've been invited to collaborate on this server. Sign up with any email address and password to continue.`
    signingUp = true
  }

  async function signIntoPageWithPassword() {
    const siteID = $page.params.site
    // if password exists, show signup form for email and password

    // on submit, create and validate new user with password
    const valid = await actions.sites.addUser({
      site: siteID,
      password: $sitePassword,
      user: {
        email,
        password,
        role: collaboratorRole,
      },
    })

    // on success, sign in
    if (valid) {
      auth.signIn({ email, password })
      replaceStateWithQuery({
        signup: null,
        role: null,
        password: null,
      })
    } else {
      largeMessage = `Could not validate your password, please ask the site admin for a new collaboration link`
    }

    function replaceStateWithQuery(values) {
      const url = new URL(window.location.toString())
      for (let [k, v] of Object.entries(values)) {
        if (!!v) {
          url.searchParams.set(encodeURIComponent(k), encodeURIComponent(v))
        } else {
          url.searchParams.delete(k)
        }
      }
      history.replaceState({}, '', url)
    }

    // const validated = await actions.sites.validatePassword(
    //   $page.params.site,
    //   $sitePassword
    // )
    // if (validated) {
    //   user.update((u) => ({
    //     ...u,
    //     role: collaboratorRole,
    //     signedIn: true,
    //   }))
    // } else {
    //   largeMessage = `Could not validate your password, please ask the site admin for a new collaboration link`
    // }
  }

  let largeMessage
  let headerMessage
  let smallMessage
  let loadingEmail

  let email,
    password = ''
  $: disabled = !email || password.length <= 3

  async function signUp() {
    if ($sitePassword) {
      signIntoPageWithPassword()
      return
    }

    loadingEmail = true
    smallMessage = null
    largeMessage = null
    const res = await createUser({
      email,
      password,
      role: collaboratorRole,
      invitationKey,
    })

    if (!res) {
      largeMessage =
        'Could not sign up. Ask the server Admin to send you a new invitation link.'
    } else if (res.success) {
      window.history.pushState('', document.title, window.location.origin) // remove query params from url
      signIn()
    } else {
      largeMessage =
        'Something strange happened. Feel free to file a <a href="https://github.com/primodotso/primo/issues/new?assignees=&labels=&template=bug_report.md&title=">bug report</a> or ask for help in the Discord'
    }
    loadingEmail = false
  }

  async function signIn() {
    smallMessage = ''
    loadingEmail = true
    if (!$user.signedIn) {
      const { error } = await auth.signIn({ email, password })
      if (error) {
        smallMessage = error.message
      } else if ($page.params.site) {
        // kick out if user doesn't have access to site
        const [u] = await users.get(null, '*', email)
        const sites = JSON.parse(u.sites)
        if (Array.isArray(sites) && !sites.includes($page.params.site)) {
          await auth.signOut()
          window.location.reload()
        }
      }
    }
    loadingEmail = false
  }

  async function resetPassword() {
    const { error } = await auth.resetPassword(email)
    if (error) {
      smallMessage = error.message
    } else {
      largeMessage = `A link has been sent to <strong>${email}</strong> with instructions to reset your password`
    }
  }

  let mounted
  onMount(() => (mounted = true))

  let signingUp = false
</script>

{#key signingUp}
  <main class="primo-modal primo-reset" in:fade>
    <div class="logo" xyz="fade">
      <img
        src={$config.customization.logo.url}
        alt={$config.customization.logo.alt}
      />
    </div>

    {#if largeMessage}
      <div in:fade class="login-message">
        {@html largeMessage}
      </div>
    {:else if loading}
      <div class="spinner">
        <Spinner />
      </div>
    {:else}
      <div class="login-form">
        {#if smallMessage}
          <span class="login-error" in:fade>{@html smallMessage}</span>
        {/if}
        {#if headerMessage}
          <div class="header-message">
            {headerMessage}
          </div>
        {/if}
        <form on:submit|preventDefault xyz="delay-10" class:xyz-in={mounted}>
          <div class="inputs">
            <div class="form-group">
              <label for="email-address" class="sr-only">Email address</label>
              <input
                id="email-address"
                class="primo-input"
                bind:value={email}
                name="email"
                type="email"
                autocomplete="email"
                required
                placeholder="Email address"
              />
            </div>
            <div class="form-group">
              <label for="password" class="sr-only">Password</label>
              <input
                id="password"
                class="primo-input"
                bind:value={password}
                name="password"
                type="password"
                autocomplete="current-password"
                required
                placeholder="Password"
              />
            </div>
          </div>

          <PrimaryButton
            disabled={disabled || loadingEmail}
            loading={loadingEmail}
            on:click={signingUp ? signUp : signIn}
            type="submit"
          >
            <svg
              slot="icon"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              ><path
                d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
              /><path
                d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
              /></svg
            >
            <span slot="label">
              {#if signingUp}
                <span>Sign up with Email</span>
              {:else}
                <span>Sign in</span>
              {/if}
            </span>
          </PrimaryButton>
          <div class="secondary">
            {#if !signingUp}
              <button type="button" on:click={resetPassword}>
                Forgot your password?
              </button>
            {/if}
          </div>
        </form>
        <!-- <hr />
        <div class="providers">
          <PrimaryButton on:click={signUpWithProvider}>
            {#if loadingProvider}
              <Spinner />
            {:else}
              <svg
                class="github"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                width="24px"
                height="24px"
                ><path
                  d="M44,24c0,8.96-5.88,16.54-14,19.08V38c0-1.71-0.72-3.24-1.86-4.34c5.24-0.95,7.86-4,7.86-9.66c0-2.45-0.5-4.39-1.48-5.9 c0.44-1.71,0.7-4.14-0.52-6.1c-2.36,0-4.01,1.39-4.98,2.53C27.57,14.18,25.9,14,24,14c-1.8,0-3.46,0.2-4.94,0.61 C18.1,13.46,16.42,12,14,12c-1.42,2.28-0.84,4.74-0.3,6.12C12.62,19.63,12,21.57,12,24c0,5.66,2.62,8.71,7.86,9.66 c-0.67,0.65-1.19,1.44-1.51,2.34H16c-1.44,0-2-0.64-2.77-1.68c-0.77-1.04-1.6-1.74-2.59-2.03c-0.53-0.06-0.89,0.37-0.42,0.75 c1.57,1.13,1.68,2.98,2.31,4.19C13.1,38.32,14.28,39,15.61,39H18v4.08C9.88,40.54,4,32.96,4,24C4,12.95,12.95,4,24,4 S44,12.95,44,24z"
                /></svg
              >
              <span>{signingUp ? "Sign up" : "Sign in"} with Github</span>
            {/if}
          </PrimaryButton>
        </div> -->
      </div>
    {/if}
  </main>
{/key}

<style lang="postcss">
  :global(:root) {
    --ModalContainer-justify: center;
  }

  input {
    border: 0;
    padding: 0.5rem;
    background: white;
  }

  main {
    padding: 1.5rem;
    max-width: 20rem;

    .logo {
      text-align: center;
      padding: 0 1rem 1rem 1rem;
      display: flex;
      justify-content: center;

      img {
        max-height: 4rem;
        max-width: 200px;
        object-fit: contain;
      }
    }

    .login-message {
      border-radius: 0.25rem;
      padding: 1.5rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      text-align: center;
      font-weight: 600;
    }

    .spinner {
      display: flex;
      justify-content: center;
      padding: 2rem 0;
    }

    .login-error {
      display: block;
      padding: 1rem 0;
      border-radius: 0.25rem;
      margin-bottom: 1rem;
      border: 2px solid var(--color-caution);
    }

    .header-message {
      font-size: 0.875rem /* 14px */;
      line-height: 1.25rem /* 20px */;
      padding: 0.75rem;
      color: var(--color-gray-1);
      font-weight: 600;
      border-radius: 0.25rem;
      margin-bottom: 0.5rem;
    }

    form {
      margin-bottom: 1rem;
      & > * {
        margin: 0.5rem 0;
      }

      .inputs {
        color: var(--color-gray-9);
        font-size: var(--font-size-2);

        label {
          font-weight: 500;
          color: white;
          margin-bottom: 0.5rem;
          display: block;
        }

        input {
          border: 0;
        }

        .form-group:first-child .primo-input {
          border-radius: var(--primo-border-radius) var(--primo-border-radius) 0
            0;
        }

        .form-group:last-child .primo-input {
          border-radius: 0 0 var(--primo-border-radius)
            var(--primo-border-radius);
        }

        .form-group {
          display: block;
          background: transparent;

          &:first-child {
            border-bottom: 1px solid var(--color-gray-3);
          }
        }
      }

      .secondary {
        font-size: var(--font-size-1);
        font-weight: 500;
        color: var(--color-gray-1);
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;

        button:hover {
          color: var(--color-primored);
        }
      }

      --Spinner-size: 1rem;
      --Spinner-mr: 0.5rem;

      svg {
        width: 1rem;
        height: 1rem;
        color: var(--color-white);
        margin-right: 0.5rem;
      }
    }

    /* hr {
      margin: 1rem 0;
      border-color: var(--color-gray-8);
    } */

    /* .providers {
      --color-link: var(--color-gray-8);
      --color-link-hover: var(--color-primored-dark);

      .github {
        margin-right: 0.5rem;
        width: 1.25rem;
      }
    } */
  }
</style>
