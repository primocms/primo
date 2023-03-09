<script>
  import Page from '$lib/editor/views/editor/Page.svelte'
  import { page } from '$app/stores'

  export let data
</script>

<Page id={$page.params.page} {data} />
