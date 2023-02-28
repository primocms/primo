<script>
  import Page from '$lib/editor/views/editor/Page.svelte'
  import { page } from '$app/stores'
</script>

<Page id={$page.params.page} />
