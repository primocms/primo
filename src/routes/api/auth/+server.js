import { authorizeRequest } from '../_auth'
import {signUp} from '../../../supabase/auth'
import supabaseAdmin, {getNumberOfUsers} from '../../../supabase/admin'
import {json} from '@sveltejs/kit'

export async function POST(event) {
  const payload = await event.request.json()
  const nUsers = await getNumberOfUsers()
  if (nUsers === 0) {
    const {error} = await createUser(true)
    return json({success: !error})
  }

  return await authorizeRequest(event, async () => {
    const {error} = await createUser()
    if (!error) {
      await supabaseAdmin.from('config').upsert({
        id: 'invitation-key', 
        value: ''
      })
      return json({success: true})
    } else return json({success: false})
  })

  async function createUser(admin = false) {
    const { error } = await signUp(payload)
    const res = await supabaseAdmin.from('users').insert({
      email: payload.email,
      role: payload.role || (admin ? 'admin' : 'developer')
    })
    return { error }
  }
}

export async function GET() {
  const nUsers = await getNumberOfUsers()
  return json({initialized: nUsers > 0 ? true : false})
}
