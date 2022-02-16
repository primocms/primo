import { authorizeRequest } from './_auth'

export async function get(event) {
  return await authorizeRequest(event, () => ({
    body: {
      success: true
    }
  }))
}