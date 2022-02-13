import { authorizeRequest } from './_auth'
import {signUp} from '../../supabase/auth'
import {users, config} from '../../supabase/db'
import {getNumberOfUsers} from '../../supabase/admin'

export async function post({ request }) {
  const payload = await request.json()
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

  return await authorizeRequest(request, async () => {
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
    await users.create( admin ? 
    {
      ...payload,
      role: 'admin'
    } : payload)
    return supabase
  }
}

export async function get() {
  const nUsers = await getNumberOfUsers()
  return {
    body: {
      initialized: nUsers > 0 ? true : false
    }
  }
}
