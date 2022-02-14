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