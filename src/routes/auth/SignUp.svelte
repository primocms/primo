<script>
  import { createEventDispatcher } from 'svelte'
  import { page } from '$app/stores'

  const dispatch = createEventDispatcher()

  export let email
  export let password
</script>

<form method="POST" action="?/sign_up">
  <label>
    <span>Email</span>
    <input name="email" bind:value={email} type="text" />
  </label>
  <label>
    <span>Password</span>
    <input name="password" bind:value={password} type="password" />
  </label>
  <input
    name="invitation_id"
    type="text"
    class="hidden"
    value={$page.url.searchParams.get('join')}
  />
  <button type="submit">Create account</button>
</form>
<span class="footer-text"
  >Already have an account? <button on:click={() => dispatch('switch')}
    >Sign in</button
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

    button {
      color: #1d5ffc;
    }
  }
</style>
