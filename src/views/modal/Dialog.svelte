<script>
  export let message = ''
  export let onSubmit

  let value = ''
</script>

<main>
  <div class="message">{message}</div>
  <form on:submit|preventDefault={() => onSubmit(value)}>
    <input type="url" bind:value autofocus>
  </form>
</main>

<style lang="postcss">
  main {
    color: var(--primo-color-white);
    background: var(--primo-color-black);
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
  }

  .message {

  }

  form {
    input {
      padding: 0.5rem;
      color: var(--primo-color-black);
    }
  }
</style>
