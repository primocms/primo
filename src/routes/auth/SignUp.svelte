<script>
  import { enhance } from '$app/forms'
  import { page, navigating } from '$app/stores'
  import Icon from '@iconify/svelte'

  export let email
  export let password
</script>

<form class="form" method="POST" action="?/sign_up" use:enhance>
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
  <button class="button" type="submit">
    {#if !$navigating}
      <span>Create account</span>
    {:else}
      <div class="icon"><Icon icon="gg:spinner" /></div>
    {/if}
  </button>
</form>

<!-- <span class="footer-text"
  >Already have an account? <button on:click={() => dispatch('switch')}
    >Sign in</button
  ></span
> -->
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
      margin-bottom: 1rem;

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

  /* .footer-text {
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
  } */
</style>
