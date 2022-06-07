import supabaseAdmin from '../../supabase/admin'

export async function get() {
  const {data = []} = await supabaseAdmin.from('hosts').select('*')
  const hosts = data.map(host => {
    delete host.token // remove sensitive data
    return host
  })
  return {
    body: hosts
  }
}