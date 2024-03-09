import { json } from '@sveltejs/kit'
import supabase_admin from '$lib/supabase/admin'
import { html_server } from '../../../compiler/cloud-workers/server-compiler.js'
import postcss from '../../../compiler/cloud-workers/server-postcss.js'

export const GET = async (event) => {
  const symbol = event.url.searchParams.get('symbol')
  const { data } = await supabase_admin
    .from('symbols')
    .select('*')
    .eq('id', symbol)
    .order('created_at', { ascending: false })
    .single()

  const css = await postcss(data.code.css || '')

  let res = {}
  try {
    res = await html_server({
      component: {
        id: symbol,
        data: data.content.en,
        html: data.code.html,
        css: css,
        js: data.code.js,
      },
    })
  } catch (e) {
    console.log(e.message)
  }

  return json(res)
}
