<script>
  import Image from './Dialogs/Image.svelte'
  import Feedback from './Dialogs/Feedback.svelte'
  export let component
  export let componentProps = {}
  export let onSubmit 

  let value = ''
</script>

<main>
  {#if component === 'IMAGE'}
    <Image on:submit={({detail}) => onSubmit(detail)} />
  {:else if component === 'LINK'}
    <div class="message">Enter URL</div>
    <form on:submit|preventDefault={() => onSubmit(value)}>
      <!-- svelte-ignore a11y-autofocus -->
      <input type="url" bind:value autofocus>
    </form>
  {:else if component === 'FEEDBACK'}
    <Feedback />
  {:else if typeof(component) !== 'string'}
    <svelte:component this={component} {...componentProps} />
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

  form {
    input {
      padding: 0.5rem;
      color: var(--primo-color-black);
    }
  }
</style>
