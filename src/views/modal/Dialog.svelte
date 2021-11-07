<script>
  import Image from './Dialogs/Image.svelte'
  export let component
  export let onSubmit 

  let value = ''
</script>

<main>
  {#if component === 'IMAGE'}
    <Image on:submit={({detail}) => onSubmit(detail)} />
  {:else if component === 'LINK'}
    <div class="message">Enter URL</div>
    <form on:submit|preventDefault={() => onSubmit(value)}>
      <input type="url" bind:value autofocus>
    </form>
  {/if}
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
