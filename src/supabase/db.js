import {get} from 'svelte/store'
import supabase from './core'
import user from '../stores/user'

const subscriptions = {}

export async function acceptInvitation(pass, userID) {
  const {data,error} = await supabase
    .from('sites')
    .select('password, id, collaborators, owner (username, id, websites)')
    .or(`password.eq.CONTENT-${pass},password.eq.DEV-${pass}`)
  const site = data[0]
  if (!site || error) { // password incorrect
    console.error(error)
    return {error}
  }

  const collaborators = site.collaborators || []
  const {websites} = await users.get(userID, `websites`)

  const role = site.password.includes('DEV') ? 'DEV' : 'CONTENT'
  const date = (new Date()).toJSON()

  // link is valid, add collaborator to site (user id, role)
  const [ collaboratorAdded ] = await Promise.all([
    sites.update(site.id, { 
      collaborators: JSON.stringify([ ...collaborators, {
        id: userID,
        role: 'DEV',
        created: date,
        loggedin: date
      }]),
      password: '' 
    }),
    users.update(userID, {
      websites: [ ...websites, site.id ] // concat 
    })
  ])
  
  return collaboratorAdded
}

export async function checkUsernameAvailability(username) {
  const {data,error} = await supabase
    .from('users')
    .select('id')
    .filter('username', 'eq', username)
  return data[0] ? false : true
}

const DEFAULT_SITES_QUERY = `
  id,
  name,
  password,
  active_editor,
  host,
  active_deployment
`

export const sites = {
  get: async ({id = null, path = null, query = DEFAULT_SITES_QUERY }) => {
    let site
    if (id) {
      const {data,error} = await supabase
        .from('sites')
        .select(query)
        .filter('id', 'eq', id)
      if (error) {
        console.error(error)
        return null
      } else {
        const site = data[0]
        if (site) {
          let { data, collaborators } = site
          if (data && typeof data === 'string') {
            site.data = JSON.parse(data)
          }
        }
        return site
      }
    } else if (path) {
      const [ user, siteUrl ] = path.split('/')
      const {data,error} = await supabase
        .from('sites')
        .select(query)
        .filter('owner.username', 'eq', user)
        .filter('url', 'eq', siteUrl)
      if (error) {
        console.error(error)
        site = null
      } else {
        site = data[0]
      }
    } else {

      // fetch all sites

      const {data,error} = await supabase
        .from('sites')
        .select(query)

      // filter ones which user is allowed to see
      const filtered = data.filter(site => {
        return true
      })

      site = filtered
    }
    if (site && typeof site.data === 'string') {
      site.data = JSON.parse(site.data)
    }
    return site
  },
  create: async ({ id, name }) => {
    const { data, error } = await supabase
      .from('sites')
      .insert([
        { id, name }
      ])
      .select()
    if (error) {
      console.error(error)
      return null
    }
    return data[0]
  },
  delete: async (id) => {
    const { data, error } = await supabase
      .from('sites')
      .delete()
      .match({ id })
    if (error) {
      console.error(error)
      return null
    }
    return data
  },
  save: async (id, site) => {
    const json = JSON.stringify(site)
    const { data, error } = await supabase
      .from('sites')
      .update({ data:json }, {
        returning: 'minimal'
      })
      .filter('id', 'eq', id)
    if (error) {
      console.error(error)
      return false
    }
    return true
  },
  update: async (id, props) => {
    const { error } = await supabase
      .from('sites')
      .update(props, {
        returning: 'minimal'
      })
      .filter('id', 'eq', id)
    if (error) {
      console.error(error)
      return null
    }
    return true
  },
  subscribe: async (id, fn) => {
    const existingSubscription = subscriptions[id]
    if (existingSubscription) { // prevent duplicating subscriptions (also prevents reassigning fwiw)
      return existingSubscription
    } else {
      const subscription = supabase
        .from(`sites:id=eq.${id}`)
        .on('UPDATE', fn)
        .subscribe()
      subscriptions[id] = subscription
      return subscription
    }
  }
}

export const users = {
  get: async (uid = null, select = '*', email = null) => {
    let data
    let error
    if (uid) {
      const res = await supabase
        .from('users')
        .select(select)
        .eq('id', uid)
      data = res.data
      error = res.error
    } else if (email) {
      const res = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
      data = res.data
      error = res.error
    } else {
      const res = await supabase
      .from('users')
      .select(select)
      data = res.data
      error = res.error
    }
  

    if (error) {
      console.error(error)
      return null
    }
    return data
  },
  create: async ({ email, role = 'developer' }) => {
    const { error } = await supabase
      .from('users')
      .insert([ { email, role } ])
    if (error) {
      console.error(error)
      return false
    }
    return true
  },
  update: async (email, props) => {
    const { data, error } = await supabase
      .from('users')
      .update(props)
      .eq('email', email)

    if (error) {
      console.error(error)
      return null
    }
    return data[0]
  },
  delete: async (email) => {
    const { data, error } = await supabase
      .from('users')
      .delete()
      .match({ email })
    if (error) {
      console.error(error)
      return null
    }
    return data
  }
}

export const hosts = {
  get: async (id) => {
    const {data,error} = await supabase
      .from('hosts')
      .select('*')
    if (error) {
      console.error(error)
      return null
    }
    return data
  },
  create: async ({ name, token }) => {
    const { data, error } = await supabase
      .from('hosts')
      .insert([
        { name, token }
      ]).select()
    if (error) {
      console.error(error)
      return null
    }
    return data[0]
  },
  delete: async (name) => {
    const { data, error } = await supabase
      .from('hosts')
      .delete()
      .match({ name })
    if (error) {
      console.error(error)
      return null
    }
    return data
  }
}

export const config = {
  get: async (id) => {
    const {data,error} = await supabase
      .from('config')
      .select('*')
      .eq('id', id)
    if (error) {
      console.error(error)
      return null
    }
    return data?.[0]['value']
  },
  update: async ({id, value = '', options = null}) => {
    const { data, error } = await supabase
      .from('config')
      .upsert({ id, value, options })
      .select()
    if (error) {
      console.error(error)
      return null
    }
    return data[0] ? true : false
  }
}