import { authorizeRequest } from './_auth'
import {json} from '@sveltejs/kit'

export async function GET(event) {
  return await authorizeRequest(event, async () => {
    return json({
      body: {success: true} 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  })
}