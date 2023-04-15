<script>
  import { createEventDispatcher } from 'svelte'
  import { page } from '$app/stores'

  const dispatch = createEventDispatcher()

  export let email
  export let password
</script>

<form class="form" method="POST" action="?/sign_up">
  <div class="fields">
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
  </div>
  <button type="submit">Create account</button>
</form>
<span class="footer-text"
  >Already have an account? <button on:click={() => dispatch('switch')}
    >Sign in</button
  ></span
>

<style lang="postcss">
  .form {
    display: grid;
    gap: 1.5rem;
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

    button {
      color: #cecece;
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      padding: 0.65rem;
      border: 1.5px solid #35d994;
      border-radius: 0.25rem;
      margin-bottom: 0.75rem;
    }
  }

  .footer-text {
    display: flex;
    gap: 0.25rem;
    font-size: 0.875rem;
    line-height: 1.125rem;
    color: #797979;
    text-align: left;

    button {
      color: #b6b6b6;
      text-decoration: underline;
    }
  }
</style>
