import supabaseAdmin from '../../../supabase/admin'
import {json} from '@sveltejs/kit'

export async function GET() {
  const {data = []} = await supabaseAdmin.from('hosts').select('*')
  const hosts = data.map(host => {
    delete host.token // remove sensitive data
    return host
  })
  return json(hosts)
}