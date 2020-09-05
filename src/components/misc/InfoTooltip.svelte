<script>
  export let info;
</script>

<span class="has-tooltip-multiline" data-tooltip={info} aria-label={info}>
  <span class="icon is-small">
    <i class="far fa-question-circle"></i>
  </span>
</span>

<style>
  span[data-tooltip] {
    margin-left: 0.5rem;
  }
</style>


<svelte:head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma-tooltip@3.0.2/dist/css/bulma-tooltip.min.css">
</svelte:head>