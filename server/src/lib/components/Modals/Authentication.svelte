<script>
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { find } from 'lodash'
  import axios from 'axios'
  import auth from '../../../supabase/auth'
  import { users } from '../../../supabase/db'
  import * as actions from '../../../actions'
  import { createUser } from '../../../supabase/helpers'
  import { page } from '$app/stores'
  import { browser } from '$app/env'

  import Spinner from '$lib/ui/Spinner.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import Logo from '$lib/ui/Logo.svelte'
  import user from '../../../stores/user'
  import { sitePassword } from '../../../stores/misc'

  export let onSignIn = () => {}

  if (browser) {
    axios.get('/api/auth.json').then(({ data }) => {
      if (!data.initialized) {
        signingUp = true
      }
    })
  }

  let loading

  let collaboratorRole = $page.url.searchParams.get('role')
  $sitePassword = $page.url.searchParams.get('password')

  $: newSignup = $page.url.searchParams.get('signup') === ''
  $: invitationKey = $page.url.searchParams.get('key')
  $: newSignup && invitationKey && signUpWithPassword()
  $: !newSignup && $sitePassword && signIntoPageWithPassword()

  $: if ($user.signedIn) {
    onSignIn()
  }

  async function signUpWithPassword() {
    loginError = `You've been invited to collaborate on this server. Sign up with any email address and password to continue.`
    signingUp = true
  }

  async function signIntoPageWithPassword() {
    loginMessage = `Signing you in...`
    const validated = await actions.sites.validatePassword(
      $page.params.site,
      $sitePassword
    )
    if (validated) {
      user.update((u) => ({
        ...u,
        role: collaboratorRole,
        signedIn: true,
      }))
    } else {
      loginMessage = `Could not validate your password, please ask the site admin for a new collaboration link`
    }
  }

  let loginMessage
  let headerMessage
  let loginError
  let loadingEmail

  let email,
    password = ''
  $: signInWithMagicLink = !signingUp && email && !password
  $: disabled = !signInWithMagicLink && (!email || password.length <= 3)

  async function signUp() {
    loadingEmail = true
    loginError = null
    loginMessage = null
    const res = await createUser({
      email,
      password,
      role: collaboratorRole,
      invitationKey,
    })
    if (!res) {
      loginMessage =
        'Could not sign up. Ask the server Admin to send you a new invitation link.'
    } else {
      signIn()
    }
    loadingEmail = false
  }

  async function signIn() {
    loginError = ''
    loadingEmail = true

    if (!$user.signedIn) {
      const { error, user: res } = await auth.signIn({ email, password })
      user.update((u) => ({ ...u, signedIn: true }))
      const role = find(await users.get(), ['email', email])['role']
      if (error) {
        loginError = error.message
      } else if (signInWithMagicLink) {
        loginMessage = `A magic link has been sent to <strong>${email}</strong>.<br>When you click on it, you'll be logged into primo.`
      } else if (res) {
        user.update((u) => ({
          ...u,
          admin: role === 'admin',
          role: role === 'admin' ? 'developer' : role,
        }))
      }
    }
  }

  async function resetPassword() {
    const { error } = await auth.resetPassword(email)
    if (error) {
      loginError = error.message
    } else {
      loginMessage = `A link has been sent to <strong>${email}</strong> with instructions to reset your password`
    }
  }

  let mounted
  onMount(() => (mounted = true))

  let signingUp = false
</script>

{#key signingUp}
  <main class="primo-modal primo-reset" in:fade>
    <div class="logo">
      <a href="https://primo.af" target="blank" xyz="fade">
        <Logo />
      </a>
    </div>

    {#if loginMessage}
      <div in:fade class="login-message">
        {@html loginMessage}
      </div>
    {:else if loading}
      <div class="spinner">
        <Spinner />
      </div>
    {:else}
      <div class="login-form">
        {#if loginError}
          <span class="login-error" in:fade>{@html loginError}</span>
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

          {#key signInWithMagicLink}
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
                {:else if signInWithMagicLink}
                  <span>Sign in with magic link</span>
                {:else}
                  <span>Sign in</span>
                {/if}
              </span>
            </PrimaryButton>
          {/key}
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

      a {
        width: 16rem;
        padding: 0 2rem;
        opacity: 1;
        transition: opacity 0.2s;

        &:hover {
          opacity: 0.75;
        }
      }
    }

    .login-message {
      border-radius: 0.25rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      text-align: center;
      font-weight: 600;

      .spinner {
        display: flex;
        justify-content: center;
        margin-bottom: 0.5rem;
      }
    }

    .login-error {
      display: block;
      padding: 1rem;
      border-radius: 0.25rem;
      font-weight: 600;
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

        .switch {
          margin-left: auto;
          text-decoration: underline;
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

    hr {
      margin: 1rem 0;
      border-color: var(--color-gray-8);
    }

    .providers {
      --color-link: var(--color-gray-8);
      --color-link-hover: var(--color-primored-dark);

      .github {
        margin-right: 0.5rem;
        width: 1.25rem;
      }
    }
  }
</style>
