import {database,storage} from '$lib/services'

export const sites = {
  create: async (data, preview = null) => {

    await database.insert({
      table: 'sites',
      data: data.site
    })

    // create symbols and root pages 
    const { pages, symbols, sections } = data
    const home_page = pages.find(page => page.url === 'index')
    const root_pages = pages.filter(page => page.parent === null && page.id !== home_page.id)
    const child_pages = pages.filter(page => page.parent !== null)

    // create home page first (to ensure it appears first)
    await database.insert({
      table: 'pages',
      data: home_page
    })

    await Promise.all([
      database.insert({ table: 'symbols', data: symbols }),
      database.insert({ table: 'pages', data: root_pages }),
    ])

    // upload preview to supabase storage
    if (preview) {
      await storage.upload({
        bucket: 'sites',
        key: `${data.site.id}/preview.html`,
        file: preview,
      })
    }

    // create child pages (dependant on parent page IDs)
    await database.from({
      table: 'pages',
      data: child_pages
    })

    // create sections (dependant on page IDs)
    await database.insert({
      table: 'sections',
      data: sections
    })

  },
  delete: async (id, files = false) => {
    const sections_to_delete = await database.get_site_sections(id)
    await Promise.all(
      sections_to_delete.map(async section => {
        await database.delete({ table: 'sections', id: section.id })
      })
    )
    await Promise.all([
      database.delete({ table: 'pages', match: { site: id } }),
      database.delete({ table: 'symbols', match: { site: id } }),
      database.delete({ table: 'invitations', match: { site: id } }),
      database.delete({ table: 'collaborators', match: { site: id } }),
    ])
    if (files) {
      // TODO
      // let siteFiles = await getFiles('sites', id)
      // if (siteFiles.length) await supabase.storage.from('sites').remove(siteFiles)

      // let imageFiles = await getFiles('images', id)
      // if (imageFiles.length) await supabase.storage.from('images').remove(imageFiles)
    }

    await database.delete({ table: 'sites', id })
  }
}