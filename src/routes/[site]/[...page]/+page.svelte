<script>
  import { PrimoPage } from '@primocms/builder'
  import { database } from '$lib/services'
  import { page as page_store } from '$app/stores'

  let loading = true
  let page

  const site_url = $page_store.params.site
  const client_params = $page_store.params.page?.split('/') || null
  const page_url = client_params === null ? 'index' : client_params.pop()

  Promise.all([
    database.get_page({ site_url, page_url }),
    database.get_page_sections({ site_url, page_url }),
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
