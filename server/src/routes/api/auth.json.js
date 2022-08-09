import { authorizeRequest } from './_auth'
import {signUp} from '../../supabase/auth'
import {users, config} from '../../supabase/db'
import supabaseAdmin, {getNumberOfUsers} from '../../supabase/admin'

export async function POST(event) {
  const payload = await event.request.json()
  const nUsers = await getNumberOfUsers()
  if (nUsers === 0) {
    const supabase = await createUser(true)
    return {
      body: {
        success: true,
        supabase
      }
    }
  }

  return await authorizeRequest(event, async () => {
    await createUser()
    await config.update('invitation-key', '')
    return {
      body: {
        success: true
      }
    }
  })

  async function createUser(admin = false) {
    const supabase = await signUp(payload)
    await supabaseAdmin.from('users').insert([{
      email: payload.email,
      role: payload.role || (admin ? 'admin' : 'developer')
    }])
    return supabase
  }
}

export async function GET() {
  const nUsers = await getNumberOfUsers()
  return {
    body: {
      initialized: nUsers > 0 ? true : false
    }
  }
}
