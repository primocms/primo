<script>
  import { page, navigating } from '$app/stores'
  import Icon from '@iconify/svelte'
  import { authentication } from '$lib/services'
  import { goto } from '$app/navigation'
  import { user } from '$lib/stores'

  export let email
  export let password

  async function sign_in() {
    const { user: res, error } = await authentication.sign_in({
      email,
      password,
    })
    console.log({ user, error })
    if (error) {
      console.error(error)
    } else {
      $user = res
      goto('/')
    }
  }
</script>

<form class="form" on:submit|preventDefault={sign_in}>
  <div class="fields">
    <label>
      <span>Email</span>
      <input bind:value={email} type="text" name="email" />
    </label>
    <label>
      <span>Password</span>
      <input bind:value={password} type="password" name="password" />
    </label>
    <input
      name="invitation_id"
      type="text"
      class="hidden"
      value={$page.url.searchParams.get('join')}
    />
  </div>
  <button class="button" type="submit">
    {#if !$navigating}
      <span>Sign in</span>
    {:else}
      <div class="icon"><Icon icon="gg:spinner" /></div>
    {/if}
  </button>
</form>

<!-- <span class="footer-text"
  >Don't have an account? <button on:click={() => dispatch('switch')}
    >Sign Up</button
  ></span
> -->
<style lang="postcss">
  .form {
    display: grid;
    gap: 2rem;
    width: 100%;

    .fields {
      display: grid;
      gap: 1rem;
    }

    label {
      color: #b6b6b6;
      display: grid;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 400;
    }

    input {
      color: #dadada;
      border-radius: 0.25rem;
      border: 1px solid #6e6e6e;
      padding: 0.75rem;
      background-color: #1c1c1c;
      font-size: 1rem;

      &.hidden {
        display: none;
      }
    }

    .button {
      color: #cecece;
      font-weight: 500;
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      padding: 0.65rem;
      border: 1.5px solid #35d994;
      border-radius: 0.25rem;

      &:hover {
        background-color: #35d994;
        transition: 0.2s;
        color: #121212;
      }

      &:focus {
        background-color: #208259;
      }

      .icon {
        animation: icon-spin 1s linear infinite;
      }

      @keyframes icon-spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    }
  }
</style>
