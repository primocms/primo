<script>
  export let email
</script>

<div class="container">
  <div class="content">
    this site is locked because it's being edited by <strong>{email}</strong>
  </div>
  <div class="buttons">
    <button
      on:click={() => {
        window.location.reload()
      }}
      class="button outlined">Try again</button
    >
    <a href="/" class="button">Back to Dashboard</a>
  </div>
</div>

<style lang="postcss">
  .container {
    display: grid;
    gap: 2rem;
    padding-top: 2.5rem;
  }
  .content {
    display: flex;
    flex-direction: column;
  }
  .buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  .button {
    padding: 0.5rem 0.75rem;
    font-weight: 500;
    border-radius: 0.25rem;
    transition: 0.1s background;
    background: transparent;

    &.outlined {
      border: 2px solid var(--primo-color-primogreen);
    }

    &:hover {
      background: var(--primo-color-primogreen);
    }
  }
</style>
