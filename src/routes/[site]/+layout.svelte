<script>
  import Primo, { subscribe, storage_subscribe } from '@primocms/builder'
  import { supabase } from '$lib/supabase'

  // NEXT: finish hooking this up
  subscribe(async ({ table, action, data, id, match, order }) => {
    let res
    if (action === 'insert') {
      res = await supabase.from(table).insert(data)
    } else if (action === 'update') {
      res = await supabase.from(table).update(data).eq('id', id)
    } else if (action === 'delete') {
      if (id) {
        res = await supabase.from(table).delete().eq('id', id).select()
      } else if (match) {
        res = await supabase.from(table).delete().match(match).select()
      }
    } else if (action === 'upsert') {
      res = await supabase.from(table).upsert(data)
    } else if (action === 'select') {
      if (order) {
        res = await supabase
          .from(table)
          .select(data)
          .match(match)
          .order(...order)
      } else {
        res = await supabase.from(table).select(data).match(match)
      }
    }
    if (res.error) {
      console.log('Error: ', { res })
    }
    return res.data
  })

  storage_subscribe(async ({ bucket, action, key, file, options }) => {
    if (action === 'upload') {
      const { data } = await supabase.storage
        .from(bucket)
        .upload(key, file, options)
      const { data: res } = supabase.storage.from('images').getPublicUrl(key)
      return res.publicUrl
    }
  })

  export let data
</script>

{#if data.alert}
  <div class="alert">
    <div class="container">{@html data.alert}</div>
  </div>
{:else}
  <Primo
    role={data.user.role}
    data={{
      site: data.site,
      pages: data.pages,
      symbols: data.symbols,
    }}
  >
    <slot />
  </Primo>
{/if}

<style lang="postcss">
  .alert {
    position: fixed;
    inset: 0;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111;
    color: white;
    font-family: system-ui, sans-serif;

    .container {
      background: #222;
      padding: 2rem;
      border-radius: 0.25rem;

      :global(a) {
        color: #35d994;
      }
    }
  }
</style>
