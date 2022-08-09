import { authorizeRequest } from './_auth'

export async function GET(event) {
  return await authorizeRequest(event, () => ({
    body: {
      success: true
    }
  }))
}

export async function options() {
  return {
    headers: {
			'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    status: 201,
    body: 'new'
  }
}