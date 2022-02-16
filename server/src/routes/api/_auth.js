import {getServerToken, validateSitePassword, validateInvitationKey} from '../../supabase/admin'

export async function authorizeRequest(event, callback) {
  const key = event.url?.searchParams.get('key')
  const password = event.url?.searchParams.get('password')

  if (key) {
    const valid = await validateInvitationKey(key)
    return valid ? callback() : {
      body: null
    }
  } else if (password) {
    const valid = await validateSitePassword(event.params.site, password)
    return valid ? callback() : {
      body: null
    }
  } 

  const authorization = event.request.headers.get('authorization')

  if (!authorization) return { body: 'Must authorize request' }
  
  const token = authorization.replace('Basic ', '')
  const storedToken = await getServerToken()

  console.log('GOT HERE', token === storedToken)

  if (token === storedToken) return {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
    },
    ...callback()
  }
  else return {
    body: null
  }

}
