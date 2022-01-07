<script>
  import { fade } from 'svelte/transition'
</script>

<svg in:fade xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
  <path
    fill="currentColor"
    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
  />
</svg>

<style>
  svg {
    width: var(--Spinner-size, 2rem);
    height: var(--Spinner-size, 2rem);
    margin-top: var(--Spinner-mt, 0);
    margin-bottom: var(--Spinner-mb, 0);
    margin-right: var(--Spinner-mr, 0);
    margin-left: var(--Spinner-ml, 0);
    animation: spin 1s linear infinite;
    color: var(--color-white);

    circle {
      opacity: 0.25;
    }

    path {
      opacity: 0.75;
    }
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
