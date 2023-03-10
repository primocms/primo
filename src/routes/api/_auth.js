import supabaseAdmin from '../../supabase/admin'
import {getServerToken, validateSitePassword, validateInvitationKey} from '../../supabase/admin'
import {json} from '@sveltejs/kit'

export async function authorizeRequest(event, callback) {

  return callback() 
}
