<script>
  
  import {fade} from 'svelte/transition'

  export let variants = ''
</script>

<a
  style="background-image:url('./symbol.svg')"
  transition:fade
  title="Back to primo dashboard"
  class={variants}
  href="https://primo.af">
</a>

<style>
  a {
    @apply block h-full bg-codeblack transition-colors duration-200 w-10 bg-no-repeat bg-center outline-none;
    background-size: 2rem;
  }

  a:hover, a:focus {
    @apply bg-gray-800 transition-colors duration-200;
  }

</style>