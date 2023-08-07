<script>
  import {
    PrimoPage,
    realtime_subscribe,
    locked_blocks,
  } from '@primocms/builder'
  import { browser } from '$app/environment'
  import { invalidate } from '$app/navigation'
  import { createUniqueID } from '$lib/utils'

  export let data

  const { supabase } = data

  const presence_key = createUniqueID()
  const channel = supabase.channel(`locked-blocks`, {
    config: { presence: { key: presence_key } },
  })

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      channel.track({
        active_block: null,
      })
    }
  })

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    $locked_blocks = Object.entries(state)
      .map(([key, value]) => ({
        key,
        block_id: value[0]['active_block'],
        user: value[0]['user'],
      }))
      .filter((block) => block.key !== presence_key)
  })

  realtime_subscribe(async (res) => {
    channel.track({
      ...res,
      presence_key,
      user: {
        email: data.user.email,
      },
    })
  })

  if (browser) {
    supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sections',
          filter: `page=eq.${data.page.id}`,
        },
        () => {
          invalidate('app:data')
        }
      )
      .subscribe()
  }
</script>

<PrimoPage
  page={{
    ...data.page,
    sections: data.sections,
  }}
/>
