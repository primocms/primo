<svelte:head>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.min.css" integrity="sha256-+N4/V/SbAFiW1MPBCXnfnP9QSN3+Keu+NlB+0ev/YKQ=" crossorigin="anonymous" />
</svelte:head>

<script>
  import { onMount } from 'svelte'
  import ClipboardJS from 'clipboard'

  let clipboard;

  export let value;

  onMount(() => {
    new ClipboardJS(clipboard);
  })

  let copied = false

</script>

<div class="field has-addons text-sm">
  <div class="control">
    <input class="input is-info" class:is-success={copied} type="text" {value} readonly>
  </div>
  <div class="control">
    <button bind:this={clipboard} class="button" class:is-success={copied} data-clipboard-text={value} on:click={() => copied = true}>
      <span class="icon is-small">
        <i class="fas fa-copy"></i>
      </span>
    </button>
  </div>
  <div class="after-content">
    <slot></slot>
  </div>
</div>

<style>
  .after-content {
    margin-left: 1rem;
  }

  .field {
    margin: 1rem 0;
  }
</style>