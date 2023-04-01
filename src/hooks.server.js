import '$lib/supabase'
import supabaseAdmin from './supabase/admin';

export const handle = async ({ resolve, event }) => {
  const response = await resolve(event);

  const is_preview = event.url.searchParams.has('preview')
  if (is_preview) {
    const {data,error} = await supabaseAdmin.from('pages').select('preview, site!inner(*)').match({
      'site.url': event.params.site,
      url: event.params.page || 'index'
    }).single()
    return new Response(data ? data.preview : 'none found', {
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