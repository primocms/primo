import { authorizeRequest } from './_auth'

export async function get(req) {
  return await authorizeRequest(req, () => ({
    body: {
      success: true
    }
  }))
}