import { authorizeRequest } from './_auth'
import {signUp} from '../../supabase/auth'
import {users, config} from '../../supabase/db'
import {getNumberOfUsers} from '../../supabase/admin'

export async function post(req) {
  const nUsers = (await users.get()).length
  if (nUsers === 0) {
    await createUser(true)
    return {
      body: {
        success: true
      }
    }
  }

  return await authorizeRequest(req, async () => {
    await createUser()
    await config.update('invitation-key', '')
    return {
      body: {
        success: true
      }
    }
  })

  async function createUser(admin = false) {
    await signUp(req.body)
    await users.create( admin ? 
    {
      ...req.body,
      role: 'admin'
    } : req.body)
  }
}

export async function get(req) {
  const nUsers = await getNumberOfUsers()
  return {
    body: {
      initialized: nUsers > 0 ? true : false
    }
  }
}