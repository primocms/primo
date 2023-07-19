<script>
  import { PrimoPage } from '@primocms/builder'
  import { database } from '$lib/services'
  import { page as page_store } from '$app/stores'

  let loading = true
  let page

  const site_url = $page_store.params.site
  const page_url = 'index'

  Promise.all([
    database.get_page(site_url, page_url),
    database.get_page_sections(site_url, page_url),
  ]).then((res) => {
    page = {
      ...res[0],
      sections: res[1],
    }
    loading = false
  })
</script>

{#if !loading}
  <PrimoPage {page} />
{/if}
