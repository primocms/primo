<script>

  export let icon
  export let active = false
  
</script>

<button on:click class:active>
  <i class="fas fa-{icon}" />
  <!-- <span class="opacity-0">></span> -->
</button>

<style>
  button {
    @apply ring-1;
    --tw-ring-color: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    justify-content: center;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    transition-duration: 100ms;
    transition-property: background-color, border-color, color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms; /* do we need this */
    /* --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
    --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
    box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); */

    i {
      opacity: 1;
      transition-property: opacity;
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      transition-duration: 150ms; /* do we need this */
      transition-duration: 100ms;
    }
  }
  button:hover {

    background-color: rgba(248, 68, 73, var(--tw-bg-opacity));
    color: rgba(245, 245, 245, var(--tw-text-opacity));

    /* i {
      @apply opacity-0;
      opacity: 0;
    }
    span {
      @apply opacity-100;
      opacity: 1;
    } */
  }
  .active {
    background-color: rgba(248, 68, 73, var(--tw-bg-opacity));
    color: rgba(255, 255, 255, var(--tw-text-opacity));
  }
</style>