import '$lib/supabase'
import supabaseAdmin from './supabase/admin';

export const handle = async ({ resolve, event }) => {
  const response = await resolve(event);

  const is_preview = event.url.searchParams.has('preview')
  if (is_preview) {
    // retrieve site and page from db
    const {data:site} = await supabaseAdmin.from('sites').select('id, name, url, owner, collaborators (*)').eq('url', event.params.site).single()
    const {data:page} = await supabaseAdmin.from('pages').select('id, name, url, site!inner(*)').match({
      url: event.params.page || 'index',
      'site.url': event.params.site
    }).single()
    
    if (!site || !page) return new Response('no page found')

    const {data:file} = await supabaseAdmin.storage.from('sites').download(`${site.id}/${page.id}/index.html`)

    return new Response(file ||  'no page found', {
      headers: {  
        'Content-Type': 'text/html;charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  if(event.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  response.headers.append('Access-Control-Allow-Origin', `*`);

  // // Apply CORS header for API routes
  // if (event.url.pathname.startsWith('/api')) {
  //   // Required for CORS to work
  //   if(event.request.method === 'OPTIONS') {
  //     return new Response(null, {
  //       headers: {
  //         'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
  //         'Access-Control-Allow-Origin': '*',
  //       }
  //     });
  //   }

  //   response.headers.append('Access-Control-Allow-Origin', `*`);
  // }

  return response;
};