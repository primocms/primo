<script>
  import Primo, {
    subscribe,
    // realtime_subscribe,
    storage_subscribe,
    // locked_blocks,
  } from '@primocms/builder'
  import { browser } from '$app/environment'
  import { page as page_store } from '$app/stores'
  import { active_site, active_pages, active_symbols } from './store'
  import { database } from '$lib/services'

  const site_url = $page_store.params.site
  let loading = true

  if (browser) {
    subscribe(async ({ table, action, data, id, match, order }) => {
      let response_data
      let res
      if (action === 'insert') {
        response_data = await database.insert({ table, data })
      } else if (action === 'update') {
        response_data = await database.update({ table, data, id })
      } else if (action === 'delete') {
        response_data = await database.delete({ table, id, match })
      } else if (action === 'upsert') {
        response_data = await database.upsert({ table, data })
      } else if (action === 'select') {
        response_data = await database.select({
          table,
          query: data,
          match,
          order,
        })
      }
      return response_data
    })

    storage_subscribe(async ({ bucket, action, key, file, options }) => {
      if (action === 'upload') {
        return await database.upload({ bucket, key, file, options })
      }
    })
    console.log({ site_url })

    Promise.all([
      database.get_site(site_url),
      database.get_pages(site_url),
      database.get_symbols(site_url),
    ]).then((res) => {
      console.log({ res })
      $active_site = res[0]
      $active_pages = res[1]
      $active_symbols = res[2]
      loading = false
    })

    // TODO: reinstate realtime collaboration
    // const presence_key = createUniqueID()
    // const channel = supabase.channel(`locked-blocks`, {
    //   config: { presence: { key: presence_key } },
    // })
    // channel.subscribe(async (status) => {
    //   if (status === 'SUBSCRIBED') {
    //     channel.track({
    //       active_block: null,
    //     })
    //   }
    // })
    // channel.on('presence', { event: 'sync' }, () => {
    //   const state = channel.presenceState()
    //   $locked_blocks = Object.entries(state)
    //     .map(([key, value]) => ({
    //       key,
    //       block_id: value[0]['active_block'],
    //       user: value[0]['user'],
    //     }))
    //     .filter((block) => block.key !== presence_key)
    // })

    // realtime_subscribe(async (res) => {
    //   channel.track({
    //     ...res,
    //     presence_key,
    //   })
    // })
  }

  // if (browser) {
  //   supabase
  //     .channel('schema-db-changes')
  //     .on(
  //       'postgres_changes',
  //       {
  //         event: 'UPDATE',
  //         schema: 'public',
  //         table: 'sections',
  //         filter: `page=eq.${data.page.id}`,
  //       },
  //       () => {
  //         invalidate('app:data')
  //       }
  //     )
  //     .subscribe()
  // }
</script>

{#if !loading}
  <Primo
    data={{
      site: $active_site,
      pages: $active_pages,
      symbols: $active_symbols,
    }}
  >
    <slot />
  </Primo>
{/if}
