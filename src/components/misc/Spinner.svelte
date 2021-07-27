<script>
  import { fade } from 'svelte/transition';

</script>

<div class="spinner" in:fade>Loading...</div>

<style>
  .spinner,
  .spinner:after {
    border-radius: 50%;
    width: 10em;
    height: 10em;
  }
  .spinner {
    margin: 60px auto;
    font-size: 3px;
    position: relative;
    text-indent: -9999em;
    border-top: 1.1em solid rgba(255, 255, 255, 0.2);
    border-right: 1.1em solid rgba(255, 255, 255, 0.2);
    border-bottom: 1.1em solid rgba(255, 255, 255, 0.2);
    border-left: 1.1em solid #ffffff;
    will-change: transform;
    transform: translateZ(0);
    animation: load8 1.1s infinite linear;
  }
  @keyframes load8 {
    0% {
      -webkit-transform: rotate(0deg);
      transform: rotate(0deg);
    }
    100% {
      -webkit-transform: rotate(360deg);
      transform: rotate(360deg);
    }
  }

</style>
