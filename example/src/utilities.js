import firebase from './firebase'
import firestore from './firebase/db'
import { initialState } from './data'
import _ from 'lodash'

export async function fetchSiteData(subdomain, callback = () => {}) {
  const subdomainRef = firestore.collection('subdomains').doc(subdomain)
  const siteData = await Promise.all([
    subdomainRef.get(),
    subdomainRef.collection('pages').get(),
    subdomainRef.collection('symbols').get()
  ]).then((responses) => {
    const collections = responses
      .slice(1)
      .filter((res) => res)
      .map((res) => res.docs.map((d) => d.data()))

    const everything = responses[0].data()

    return {
      ...everything,
      pages: collections[0],
      symbols: collections[1],
    }
  })
  callback(siteData)
  return siteData
}

export async function fetchAllSites(email) {
  const userRef = firestore.collection('users').doc(email)
  const siteNameSnapshots = await userRef.collection('subdomains').get()
  const siteNames = siteNameSnapshots.docs.map(d => d.id)
  const sites = await Promise.all(
    siteNames.map(site => fetchSiteData(site))
  )
  return sites
}

export async function sendSiteInvitation(domain, email, role) {
  const res = await ax.post('primo/send-invite', { domain, email, role })
  return res
}