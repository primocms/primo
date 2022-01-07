import {get} from 'svelte/store'
import axios from 'axios'
import supabase from './core'
import {sites} from './db'
import user from '../stores/user'

export async function createUser({ email, password, role, invitationKey }) {
  const {data} = await axios.post(`/api/auth.json?key=${invitationKey}`, {
    email, 
    password,
    role
  })

  return data
}

let siteBeingEdited = null
export async function setActiveEditor(siteID, lock = true) {
  // Set the active editor and fire `remove_active_editor`, 
  // which triggers a Supabase Postgres function which 
  // waits ten seconds, then removes the active editor
  // when that returns, the function repeats
  if (lock) {
    if (siteBeingEdited === siteID) return
    siteBeingEdited = siteID
    await Promise.all([
      sites.update(siteID, {
        'active_editor': get(user).email || 'an invited user'
      }),
      supabase.rpc('remove_active_editor', {
        site: siteID,
      })
    ])
    if (siteBeingEdited === siteID) {
      siteBeingEdited = null
      setActiveEditor(siteID)
    }
  } else {
    siteBeingEdited = null
    await sites.update(siteID, {
      'active_editor': ''
    })
  }
}