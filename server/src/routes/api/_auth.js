import {getServerToken, validateSitePassword, validateInvitationKey} from '../../supabase/admin'

export async function authorizeRequest(event, callback) {
  const key = getQueryParam(event.url, 'key')
  const password = getQueryParam(event.url, 'password')

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

  if (token === storedToken) return callback()
  else return {
    body: null
  }


  function getQueryParam(url, param) {
    if (!url) return null
    const paramString = `?${url.split('?')[1]}`
    const params = new URLSearchParams(paramString);
    return params.get(param);
  }
}
