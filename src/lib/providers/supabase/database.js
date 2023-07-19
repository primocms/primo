import supabase from './index'

export default {
  create_invitation: async (invitation) => {
    await supabase.from('invitations').insert(invitation)
  },
  get_site: async (url) => {
    const {data} = await supabase.from('sites').select().filter('url', 'eq', url).single()
    return data
  },
  get_sites: async () => {
    const {data} = await supabase.from('sites').select('id, name, url, active_deployment, collaborators (*)').order('created_at', { ascending: true })
    return data
  },
  get_page: async (site_url, page_url) => {
    const {data} = await supabase.from('pages').select('*, site!inner(id, url)').match({ 'site.url': site_url, url: page_url }).single()
    return data
  },
  get_pages: async (site_url) => {
    const {data} = await supabase.from('pages').select('*, site!inner(url)').match({ 'site.url': site_url }).order('created_at', { ascending: true })
    return data
  },
  get_symbols: async (site_url) => {
    const {data} = await supabase.from('symbols').select('*, site!inner(url)').match({ 'site.url': site_url }).order('created_at', { ascending: false })
    return data
  },
  get_page_sections: async ({site_url, page_url}) => {
    const {data} = await supabase
      .from('sections')
      .select('*, symbol(*), page!inner( site!inner(url) )')
      .match({ 'page.url': page_url, 'page.site.url': site_url })
      .order('index', { ascending: false })
    return data
  },
  get_site_sections: async (site_id) => {
    const { data } = await supabase.from('sections').select('id, page!inner(*)').filter('page.site', 'eq', site_id)
    return data
  },
  get_members: async () => {
    const { data, error } = await supabase.from('server_members').select('*, user(*)')
    return data
  },
  get_member_invitations: async () => {
    const { data, error } = await supabase.from('invitations').select('*').eq('server_invitation', true)
    return data 
  },
  get_collaborators: async (site_id) => {
    const { data, error } = await supabase
      .from('collaborators')
      .select(`user (*)`)
      .filter('site', 'eq', site_id)
    if (error) {
      console.error(error)
      return []
    } else return data.map((item) => item.user)
  },
  get_collaborator_invitations: async (site_id) => {
    const { data, error } = await supabase.from('invitations').select('*').match({'site': site_id, 'server_invitation': false})
    return data
  },
  insert: async ({table, data}) => {
    const res = await supabase.from(table).insert(data)
    return res.data
  },
  update: async ({table, data, id}) => {
    const res = await supabase.from(table).update(data).eq('id', id)
    return res.data
  },
  delete: async ({table, id, match}) => {
    let res = {}
    if (id) {
      res = await supabase.from(table).delete().eq('id', id).select()
    } else if (match) {
      res = await supabase.from(table).delete().match(match).select()
    }
    return res.data
  },
  upsert: async ({table, data}) => {
    const res = await supabase.from(table).upsert(data)
    return res.data
  },
  select: async ({table, query = '*', match = {}, order = null}) => {
    let res = {}
    if (order) {
      res = await supabase
        .from(table)
        .select(query)
        .match(match)
        .order(...order)
    } else {
      res = await supabase.from(table).select(query).match(match)
    }
    return res.data
  }
}