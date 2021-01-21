<script>
  import {fade} from 'svelte/transition'

  export let size = '2xl'
  export let variants = ''
</script>

<div class="spinner text-{size} {variants}" in:fade={{ duration: 200 }}>
  <i class="fas fa-spinner"></i>
</div>

<style>

  .spinner {
    min-height: 1rem;
    min-width: 1rem;
    @apply flex justify-center items-center;
  }

  .spinner.text-xs > .fa-spinner{
    height: 12px;
    width: 12px;
  }

  i.fa-spinner {
    animation-name: spin;
    animation-duration: 1s;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
    will-change: transform;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

</style>

<svelte:head>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.min.css" integrity="sha256-+N4/V/SbAFiW1MPBCXnfnP9QSN3+Keu+NlB+0ev/YKQ=" crossorigin="anonymous" />
</svelte:head>