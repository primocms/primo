import supabase from '$lib/supabase'
import { getFiles } from '$lib/supabase/storage'
import axios from 'axios'
import { invalidate } from '$app/navigation'

export const sites = {
  create: async (data, preview = null) => {
    await supabase.from('sites').insert(data.site)

    // create symbols and root pages
    const { pages, symbols, sections } = data
    const home_page = pages.find((page) => page.url === 'index')
    const root_pages = pages.filter(
      (page) => page.parent === null && page.id !== home_page.id
    )
    const child_pages = pages.filter((page) => page.parent !== null)

    // create home page first (to ensure it appears first)
    await supabase.from('pages').insert(home_page)

    await Promise.all([
      supabase.from('symbols').insert(symbols),
      supabase.from('pages').insert(root_pages),
    ])

    // upload preview to supabase storage
    if (preview) {
      await supabase.storage
        .from('sites')
        .upload(`${data.site.id}/preview.html`, preview)
    }

    // create child pages (dependant on parent page IDs)
    await supabase.from('pages').insert(child_pages)

    // create sections (dependant on page IDs)
    await supabase.from('sections').insert(sections)
  },
  update: async (id, props) => {
    await supabase.from('sites').update(props).eq('id', id)
  },
  delete: async (site, { delete_repo, delete_files }) => {
    const [{ data: pages }, { data: sections }, { data: symbols }] =
      await Promise.all([
        supabase
          .from('pages')
          .select('id, url, name, code, fields, content, site, parent')
          .filter('site', 'eq', site.id),
        supabase
          .from('sections')
          .select('id, content, page!inner(id, site), symbol, index')
          .filter('page.site', 'eq', site.id),
        supabase
          .from('symbols')
          .select('id, name, code, fields, content, site')
          .filter('site', 'eq', site.id),
      ])

    // Backup site
    const backup_json = JSON.stringify({
      site,
      pages,
      sections: sections.map((section) => ({
        ...section,
        page: section.page.id,
      })),
      symbols,
      version: 2,
    })

    await supabase.storage
      .from('sites')
      .upload(`backups/${site.url}-${site.id}.json`, backup_json)

    if (sections) {
      await Promise.all(
        sections.map((section) =>
          supabase.from('sections').delete().eq('id', section.id)
        )
      )
    }

    await Promise.all([
      supabase.from('pages').delete().eq('site', site.id),
      supabase.from('symbols').delete().eq('site', site.id),
      supabase.from('invitations').delete().eq('site', site.id),
      supabase.from('collaborators').delete().eq('site', site.id),
    ])

    if (delete_files) {
      let siteFiles = await getFiles('sites', site.id)
      if (siteFiles.length)
        await supabase.storage.from('sites').remove(siteFiles)

      let imageFiles = await getFiles('images', site.id)
      if (imageFiles.length)
        await supabase.storage.from('images').remove(imageFiles)
    }
    if (delete_repo) {
      const repo_deleted = await axios.post('/api/deploy/delete', { site })
      if (!repo_deleted) {
        alert(
          `Could not delete repo. Ensure Personal Access Token has the 'delete_repo' permission`
        )
      }
    }
    await supabase.from('sites').delete().eq('id', site.id)
    invalidate('app:data')
  },
}
