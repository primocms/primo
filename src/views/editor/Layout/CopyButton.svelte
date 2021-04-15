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
    @apply flex items-center justify-center rounded-sm py-2 px-3 ring-1 ring-transparent transition-colors duration-100;

    i {
      @apply opacity-100 transition-opacity duration-100;
    }
  }
  button:hover {
    @apply bg-primored text-gray-100;

    /* i {
      @apply opacity-0;
    }
    span {
      @apply opacity-100;
    } */
  }
  .active {
    @apply bg-primored text-white;
  }
</style>