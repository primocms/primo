import { authorizeRequest } from './_auth'

export async function get(event) {
  return {
    headers: {
			"Access-Control-Allow-Origin": "*",
    },
    status: 201,
    body: 'new'
  }
  return await authorizeRequest(event, () => ({
    body: {
      success: true
    }
  }))
}