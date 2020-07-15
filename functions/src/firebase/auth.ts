const express = require('express');
const cors = require('cors')({origin: true});
const app = express();
// const axios = require('axios')

app.use(cors);

import {auth, db} from './core'

app.post('/sign-in-anonymously', async (req, res) => {
  let { domainName, pageId } = req.body

  const domainsCollection = db.collection("domains");
  const domainRef = domainsCollection.doc(domainName)
  const secretSnapshot = await domainRef.collection('secrets').doc(pageId).get()
  let data = secretSnapshot.data()

  let token;
  if (!data) {
    token = await createCustomToken(domainName, pageId)
  }

  res.send(token)
})

app.post('/validate-page-password', async (req, res) => {
  let { password, domainName, pageId } = req.body
  const domainsCollection = db.collection("domains");
  const domainRef = domainsCollection.doc(domainName)
  const secretSnapshot = await domainRef.collection('secrets').doc(pageId).get()
  let { password:correctPassword } = secretSnapshot.data()
  
  let passwordValid = password === correctPassword
  let token = null;

  if (passwordValid) {
    token = await createCustomToken(domainName, pageId)
  } 

  res.send({
    valid: passwordValid,
    token
  })

})

async function createCustomToken(domainName, pageId) {
  let customClaim = `${domainName}@${pageId}`
  let token = await auth.createCustomToken('anon', { page: customClaim }); // gets read by database rule
  return token
}

export default app