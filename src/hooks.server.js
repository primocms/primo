// import supabaseAdmin from './supabase/admin';
import {get} from 'svelte/store'
import {site as site_store} from '@primocms/builder'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ resolve, event }) {
  const response = await resolve(event);

  // TODO: reinstate site object & preview
  // Blocks can access all site data by fetching /primo.json
  // if (event.url.pathname === '/primo.json') {
  //   const active_site = get(site_store)
  //   const [{data:pages}, {data:symbols}, {data:site}, {data:sections}] = await Promise.all([
  //     supabaseAdmin.from('pages').select().match({site: active_site.id}),
  //     supabaseAdmin.from('symbols').select().match({site: active_site.id}),
  //     supabaseAdmin.from('sites').select().match({id: active_site.id}).single(),
  //     supabaseAdmin.from('sections').select('*, page (id, site)').eq('page.site', active_site.id),
  //   ])
  //   const json = JSON.stringify({ pages, symbols, site, sections: sections?.filter(item => item.page).map(item => ({ ...item, page: item.page.id})) })
  //   const default_json = JSON.stringify({ pages: [], symbols: [], site: {}, sections: [] })
  //   return new Response(site ? json : default_json, {
  //     headers: {  
  //       'Content-Type': 'text/json;charset=UTF-8',
  //       'Access-Control-Allow-Origin': '*',
  //     },
  //   })

  // }

  // const is_preview = event.url.searchParams.has('preview')
  // if (is_preview) {
  //   // retrieve site and page from db
  //   const [{data:site}, {data:page}] = await Promise.all([
  //     supabaseAdmin.from('sites').select('id, url').eq('url', event.params.site).single(),
  //     supabaseAdmin.from('pages').select('id, url, site!inner(*)').match({      
  //       url: event.params.page || 'index',
  //       'site.url': event.params.site
  //     }).single()
  //   ])
    
  //   if (!site || !page) return new Response('no page found')

  //   const {data:file} = await supabaseAdmin.storage.from('sites').download(`${site.id}/${page.id}/index.html`)

  //   return new Response(file ||  'no preview found', {
  //     headers: {  
  //       'Content-Type': 'text/html;charset=UTF-8',
  //       'Access-Control-Allow-Origin': '*',
  //     },
  //   })
  // }

  if(event.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  response.headers.append('Access-Control-Allow-Origin', `*`);

  return response;
};