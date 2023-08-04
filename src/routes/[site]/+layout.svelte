<script>
  import Primo, {
    database_subscribe,
    storage_subscribe,
    deploy_subscribe,
  } from '@primocms/builder'
  import axios from 'axios'

  export let data

  const { supabase } = data

  deploy_subscribe(async (payload) => {
    const {
      data: { error, deployment },
    } = await axios.post('/api/deploy', payload, {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    })
    if (error) {
      console.log('Deployment error: ', error)
      return null
    } else {
      return deployment
    }
  })

  database_subscribe(async ({ table, action, data, id, match, order }) => {
    console.log('Saving to database', { table, action, data, id, match, order })
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
      console.log('Database error: ', {
        res,
        query: { table, action, data, id, match, order },
      })
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
</script>

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
