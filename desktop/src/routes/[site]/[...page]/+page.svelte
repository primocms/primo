<script context="module">
  export const prerender = true;
</script>

<script>
  import Page from '@primo-app/primo/src/views/editor/Page.svelte'
  import { page } from '$app/stores'
</script>

<Page id={$page.params.page} />
