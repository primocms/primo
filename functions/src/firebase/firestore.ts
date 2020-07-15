const express = require('express')
const cors = require('cors')({ origin: true })
const app = express()
const _ = require('lodash')
// const axios = require('axios')

app.use(cors)

import { db } from './core'

export async function getAllDomainNames() {
  const snapshot = await db.collection('domains').get()
  return snapshot.docs.map((d) => d.id)
}

export async function getAllSubdomains() {
  const snapshot = await db.collection('subdomains').get()
  return _.flatten(
    snapshot.docs.map((d) => [`${d.id}.primo.so`, `${d.id}.localhost`])
  )
}

app.post('/hydrate-page', async (req, res) => {
  let { subdomain, pageId } = req.body

  const subdomainsCollection = db.collection('subdomains')
  const subdomainRef = subdomainsCollection.doc(subdomain)
  const pageRef = subdomainRef.collection('pages').doc(pageId)
  const snapshots = await Promise.all([pageRef.get(), subdomainRef.get()])
  const [page, site] = snapshots.map((s) => s.data())
  res.send({
    page,
    site,
  })
})

app.post('/set-page', async (req, res) => {
  let { subdomain, pageId, data } = req.body

  // if (domain.includes('localhost') && !hasSubdomain) {
  //   domain = 'primo.press'
  // }

  const subdomainsCollection = db.collection('subdomains')
  const subdomainRef = subdomainsCollection.doc(subdomain)
  const pageRef = subdomainRef.collection('pages').doc(pageId)
  await pageRef.set(data)

  res.send(true)
})

app.post('/subdomain-has-user', async (req, res) => {
  let { email, subdomain } = req.body

  const subdomainsCollection = db.collection('subdomains')
  const subdomainRef = subdomainsCollection.doc(subdomain)
  const usersSnapshot = await subdomainRef.collection('users').doc(email).get()
  res.send(usersSnapshot.exists)
})

export default app
