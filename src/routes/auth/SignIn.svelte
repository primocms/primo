<script>
  import { createEventDispatcher } from 'svelte'
  import logo from '$lib/assets/logodark.svg'
  import { sign_in } from '$lib/supabase'
  import { page } from '$app/stores'

  const dispatch = createEventDispatcher()

  export let email
  export let password
</script>

<form method="POST" action="?/sign_in">
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
  <button type="submit">Sign in</button>
</form>
<span class="footer-text"
  >Don't have an account? <button on:click={() => dispatch('switch')}
    >Sign Up</button
  ></span
>

<style lang="postcss">
  form {
    display: grid;
    gap: 1rem;

    label {
      display: grid;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    input {
      color: var(--color-gray-9);
      border-radius: 0.25rem;
      border: 1px solid #ddd;
      padding: 0.5rem;

      &.hidden {
        display: none;
      }
    }

    button {
      color: white;
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      padding: 0.5rem;
      background: #1d5ffc;
      border-radius: 0.25rem;
    }
  }

  .footer-text {
    font-size: 0.875rem;
    line-height: 1.125rem;
    color: #71788e;
    padding: 1.5rem;
    text-align: center;
    display: flex;
    gap: 0.5rem;

    button {
      all: unset;
      cursor: pointer;
      color: #1d5ffc;
    }
  }
</style>
