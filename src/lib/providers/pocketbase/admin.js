import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_PRIVATE_KEY } from '$env/static/private';
import {createClient} from '@supabase/supabase-js'

const supabase_admin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_PRIVATE_KEY);

export default {
  server_initiated: async () => {
    // const {data} = await supabase_admin.from('users').select('*')
    // return data?.length > 0
  },
  server_provisioned: async () => {
    // const {status, error} = await supabase_admin
    //   .from('sites')
    //   .select()
    //   .limit(1)
  
    // console.log(status)
    // if (status === 0) {
    //   return { success: false, error: `Could not connect your Supabase backend. Ensure you've correctly connected your environment variables.` }
    // } else if (status === 404) {
    //   console.error(error);
    //   return { success: false, error: `Your Supabase backend is connected but incorrectly provisioned. Ensure you've run the setup schema outlined in the Docs.` }
    // } else if (status === 200) { // has sites or no sites
    //   return { success: true, error: null }
    // } else {
    //   return { success: false, error: `Unknown error` }
    // }
  },
  create_invitation: async ({ email, url, server_invitation, role, site }) => {
    // const { data, error } = await supabase_admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${url}/auth/set-password?email=${email}` })

    // if (!error) {
    //   await supabase_admin
    //     .from('users')
    //     .insert({ 
    //       id: data.user.id, 
    //       email: data.user.email 
    //     })
      
    //   // Add to 'server_members' or 'collaborators'
    //   const {error} = server_invitation ? 
    //     await supabase_admin.from('server_members').insert({ user: data.user.id, role }) :
    //     await supabase_admin.from('collaborators').insert({ site, user: data.user.id, role })
  
    //   console.error(error)
    //   return {success: !error, error: error?.message}
    // } else {
    //   console.error(error)
    //   return {success: false, error: error.message}
    // }
  }
}