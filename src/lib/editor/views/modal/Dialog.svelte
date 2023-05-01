<script>
  import modal from '../../stores/app/modal'
  import Image from './Dialogs/Image.svelte'
  import Feedback from './Dialogs/Feedback.svelte'
  export let component
  export let props = {}
  export let options = {
    disableClose: false,
  }
  export let onSubmit

  let value = ''
</script>

<main class="primo-reset">
  {#if !options.disableClose}
    <header>
      <button on:click={() => modal.hide()}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 13L13 1M13 13L1 1"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </header>
  {/if}
  <div>
    {#if component === 'IMAGE'}
      <Image on:submit={({ detail }) => onSubmit(detail)} {...props} />
    {:else if component === 'LINK'}
      <div class="link">
        <div class="message">Enter URL</div>
        <form on:submit|preventDefault={() => onSubmit(value)}>
          <!-- svelte-ignore a11y-autofocus -->
          <input type="url" bind:value autofocus />
        </form>
      </div>
    {:else if component === 'FEEDBACK'}
      <Feedback />
    {:else if typeof component !== 'string'}
      <svelte:component this={component} {...props} />
    {/if}
  </div>
</main>

<style lang="postcss">
  main {
    color: var(--primo-color-white);
    background: var(--primo-color-black);
    border-radius: var(--primo-border-radius);
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    width: 100%;
    max-width: 445px;
  }

  header {
    padding: 0.5rem;
    display: flex;
    justify-content: flex-end;
    background: #1a1a1a;
  }

  form {
    input {
      padding: 0.5rem;
      color: white;
    }
  }
</style>
