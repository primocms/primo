<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  export let label;

  let copied = false;
  async function copyLabel() {
    if (!navigator.clipboard) {
      alert(
        "Unable to copy item because your browser does not support copying. Please copy manually."
      );
      return;
    }
    copied = true;
    await navigator.clipboard.writeText(label);
  }

  onMount(async () => {
    const currentlyCopied = await navigator.clipboard.readText();
    if (currentlyCopied === label) {
      copied = true;
    }
  });
</script>

<div class="copy-button">
  <button class:selected={copied} on:click={copyLabel}>
    {#if copied}
      <span class="sr-only">Copy</span>
      <svg
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        ><path
          fill-rule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clip-rule="evenodd"
        /></svg
      >
    {:else}
      <span class="sr-only">Copied</span>
      <svg
        in:fade
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        ><path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" /><path
          d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z"
        /></svg
      >
    {/if}
  </button>
  <span>{label}</span>
</div>

<style>
  .copy-button {
    display: flex;
    align-items: center;

    button {
      margin-right: 1rem;
      display: flex;
      justify-content: center;
      align-items: center;
      max-width: 28rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--primo-border-radius);
      box-shadow: var(--primo-ring-primored);

      &:hover {
        background: var(--primo-color-primored);
      }

      &.selected {
        outline-color: var(--primo-color-primored);
        pointer-events: none;
        cursor: default;
        background: var(--primo-color-gray-7);
      }

      svg {
        height: 1.5rem;
        width: 1.5rem;
      }
    }
  }
</style>
