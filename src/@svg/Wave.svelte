<script>

  import { fade } from 'svelte/transition'

</script>

<svg transition:fade xmlns="http://www.w3.org/2000/svg" width="100%" preserveAspectRatio="none" viewBox="0 0 1440 320">
  <path fill="#e0807d" fill-opacity="1" d="M0,256L80,250.7C160,245,320,235,480,192C640,149,800,75,960,58.7C1120,43,1280,85,1360,106.7L1440,128L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
  <path fill="#ce4e4a" fill-opacity="1" d="M0,256L80,250.7C160,245,320,235,480,192C640,149,800,75,960,58.7C1120,43,1280,85,1360,106.7L1440,128L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
</svg>
<!-- d8413c -->
<style>
  svg {
    min-height: 30rem;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: -1;
    /* animation-name: breathe; */
    animation-duration: 150s;
    will-change: transform;
    animation-iteration-count: infinite;
  }

  path:nth-child(2) {
    transform: translateY(1rem);
  }

@keyframes breathe {
  0% {transform: scale(1)}
  50% {transform: scale(2)}
  100% {transform: scale(1)}
}

</style>

