import {get} from 'svelte/store'
import pages from '$lib/editor/stores/data/pages'
import axios from 'axios'
import beautify from 'js-beautify'
import { supabase } from '$lib/supabase'
import { buildStaticPage } from '$lib/editor/stores/helpers'
import _ from 'lodash-es'
import {page} from '$app/stores'

export async function push_site({ token, repo }) {
  const files = (
    await buildSiteBundle({
      pages: get(pages),
    })
  ).map((file) => {
    return {
      file: file.path,
      data: file.content,
    }
  })

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  }

  const [{data:existing_repo}, {data: [latest_commit]}] = await Promise.all([
    axios.get(`https://api.github.com/repos/${repo}`, { headers }),
    axios.get(`https://api.github.com/repos/${repo}/commits?sha=main`, { headers })
  ])
  const activeSha = latest_commit?.sha

  const tree = await createTree()
  const commit = await createCommit(tree.sha)
  const final = await pushCommit(commit.sha)

  return {
    deploy_id: final.object.sha,
    repo: existing_repo,
    created: Date.now(),
  }

  async function createTree() {
    const bundle = files.map((file) => ({
      path: file.file,
      content: file.data,
      type: 'blob',
      mode: '100644',
    }))
    const { data } = await axios.post(
      `https://api.github.com/repos/${repo}/git/trees`,
      {
        tree: bundle,
      },
      { headers }
    )
    return data
  }

  async function createCommit(tree) {
    const { data } = await axios.post(
      `https://api.github.com/repos/${repo}/git/commits`,
      {
        message: 'Update site',
        tree,
        ...(activeSha ? { parents: [activeSha] } : {}),
      },
      { headers }
    )
    return data
  }

  async function pushCommit(commitSha) {
    const { data } = await axios.patch(
      `https://api.github.com/repos/${repo}/git/refs/heads/main`,
      {
        sha: commitSha,
        force: true,
      },
      { headers }
    )
    return data
  }
}

export async function buildSiteBundle({ pages }) {
  let all_sections = []
  let all_pages = []

  const page_files = await Promise.all(pages.map((page) => buildPageTree(page)))

  return buildSiteTree(page_files)

  async function buildPageTree(page) {
    const { url } = page
    const { data: sections } = await supabase
      .from('sections')
      .select()
      .eq('page', page.id)
      .order('index', { ascending: true })

    const { html, js } = await buildStaticPage({
      page,
      page_sections: sections,
      separateModules: true,
    })
    const formattedHTML = await beautify.html(html)

    const parent = pages.find(p => p.id === page.parent)

    let path
    let full_url = url
    if (url === 'index' || url === '404') {
      path = `${url}.html`
    } else if (parent){
      path = `${parent.url}/${url}/index.html`
      full_url = `${parent.url}/${url}`
    } else {
      path = `${url}/index.html`
    }

    all_sections = [ ...all_sections, ...sections ]
    all_pages = [ ...all_pages, page ]

    const page_tree = [
      {
        path,
        content: formattedHTML,
      },
    ]

    if (js) {
      page_tree.push({
        path: url === 'index' ? '_module.js' : `${full_url}/_module.js`,
        content: js,
      })
    }

    return page_tree
  }

  async function buildSiteTree(pages) {
    const site = get(page).data.site
    const symbols = get(page).data.symbols
    const json = JSON.stringify({
      site: {
        id: site.id,
        name: site.name,
        url: site.url,
        code: site.code,
        fields: site.fields,
        content: site.content
      },
      pages: all_pages.map(p => ({
        id: p.id,
        url: p.url,
        name: p.name,
        code: p.code,
        fields: p.fields,
        content: p.content,
        site: p.site,
        parent: p.parent
      })),
      sections: all_sections.map(s => ({
        id: s.id,
        content: s.content,
        page: s.page,
        site: s.site,
        symbol: s.symbol
      })),
      symbols: symbols.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        fields: s.fields,
        content: s.content,
        site: s.site
      })),
      version: 2
    })

    return [
      ..._.flattenDeep(pages),
      {
        path: `primo.json`,
        content: json,
      },
      {
        path: 'edit/index.html',
        content: `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta http-equiv="Refresh" content="0; url='${get(page).url.href}'" />
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Primo</title>
          </head>
          <body style="margin:0">
            <h1 style="font-family:sans-serif">redirecting to Primo server</h1>
          </body>
        </html>
        `
      },
      {
        path: 'robots.txt',
        content: `User-agent: *`,
      },
    ]
  }
}