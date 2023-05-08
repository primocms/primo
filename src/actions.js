import supabase from './supabase/core'

export const sites = {
  create: async (data, preview = null) => {

    await supabase.from('sites').insert(data.site)

    // create symbols and root pages 
    const { pages, symbols, sections } = data
    const home_page = pages.find(page => page.url === 'index')
    const root_pages = pages.filter(page => page.parent === null && page.id !== home_page.id)
    const child_pages = pages.filter(page => page.parent !== null)

    // create home page first (to ensure it appears first)
    await supabase.from('pages').insert(home_page)

    await Promise.all([
      supabase.from('symbols').insert(symbols),
      supabase.from('pages').insert(root_pages)
    ])

    // upload preview to supabase storage
    if (preview) {
      await supabase.storage.from('sites').upload(`${data.site.id}/preview.html`, preview)
    }

    // create child pages (dependant on parent page IDs)
    await supabase.from('pages').insert(child_pages)

    // create sections (dependant on page IDs)
    await supabase.from('sections').insert(sections)

  },
  delete: async (id) => {
    const { data: sections_to_delete } = await supabase.from('sections').select('id, page!inner(*)').filter('page.site', 'eq', id)
    await Promise.all(
      sections_to_delete.map(async section => {
        await supabase.from('sections').delete().eq('id', section.id)
      })
    )
    await Promise.all([
      supabase.from('pages').delete().match({ site: id }),
      supabase.from('symbols').delete().match({ site: id }),
      supabase.from('invitations').delete().match({ site: id }),
      supabase.from('collaborators').delete().match({ site: id }),
    ])
    await supabase.from('sites').delete().eq('id', id)
  }
}
