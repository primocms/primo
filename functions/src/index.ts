const functions = require('firebase-functions')
const express = require('express')
const cors = require('cors')({ origin: true })
const app = express()
const axios = require('axios')

const Handlebars = require('handlebars')
var sass = require('node-sass')

const Heroku = require('heroku-client')
const heroku = new Heroku({ token: functions.config().heroku.apikey })

function sendNotification(appName, args) {
  const token = {
    heroku: 'adb5gjyfjem2uswsbrqsmgjytsfro5',
    firebase: 'a257zkbwgsggiacodmom4m5fhyukdm',
    stripe: 'a4jabkxxon7j2xj8wetgcsfbvuxqpp',
    primo: 'an1vfc15rnbkun989kbgej47g2qhii',
  }[appName]
  axios.post('https://api.pushover.net/1/messages.json', {
    user: functions.config().pusher.user,
    token,
    ...args,
  })
}

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//

app.use(cors)

app.post('/handlebars', (req: any, res: any) => {
  let { source, data } = req.body

  try {
    const template = Handlebars.compile(source)
    const result = template(data)
    res.send(result)
  } catch (e) {
    var encodedError = e.message.replace(/[\u00A0-\u9999<>\&]/gim, function (
      i
    ) {
      return '&#' + i.charCodeAt(0) + ';'
    })
    res.send('<pre>' + encodedError + '</pre>')
  }
})

import { getAllDomainNames, getAllSubdomains } from './firebase/firestore'
app.post('/captcha', (req: any, res: any) => {
  let { token } = req.body

  const captchaSecretKey = functions.config().captcha.privatekey

  async function validateCaptcha() {
    let { data } = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${captchaSecretKey}&response=${token}`
    )
    return data
  }

  Promise.all([validateCaptcha(), getAllDomainNames(), getAllSubdomains()])
    .then((response) => {
      let [captchaRes, validDomains, validSubdomains] = response
      const { hostname: domain, success } = captchaRes
      validDomains = [
        ...validDomains,
        ...validSubdomains,
        'localhost',
        'primo-1.herokuapp.com',
      ]
      if (validDomains.includes(domain)) {
        res.send(success)
      } else {
        res.send(`captcha failed for ${domain}`)
      }
    })
    .catch((e) => {
      console.error(e)
      sendNotification('primo', {
        title: 'Server Error - Captcha',
        message: e.message,
      })
      res.send(false)
    })
})

app.post('/register-domain', (req: any, res: any) => {
  let { domain } = req.body

  heroku
    .post('/apps/primo-1/domains', {
      body: {
        hostname: domain,
      },
    })
    .then((result) => {
      sendNotification('heroku', {
        title: 'Domain registered',
        message: domain,
      })
      res.send(result)
    })
    .catch((e) => {
      sendNotification('heroku', {
        title: 'Domain failed to register',
        message: e.body.message,
      })
      console.error(e)
      res.send({
        e,
      })
    })
})

app.post('/unregister-domain', (req: any, res: any) => {
  let { domain } = req.body

  heroku
    .delete(`/apps/primo-1/domains/${domain}`)
    .then((result) => {
      res.send(result)
    })
    .catch((e) => {
      console.error(e)
      res.send({ e })
    })
})

app.post('/domain-status', (req: any, res: any) => {
  let { hostnames }: { hostnames: Array<any> } = req.body

  heroku
    .get('/apps/primo-1/domains')
    .then((allDomains) => {
      const relevantDomains = allDomains.filter((d) =>
        hostnames.includes(d.hostname)
      )
      res.send(relevantDomains)
    })
    .catch((e) => {
      console.error(e)
      res.send({ e })
    })
})

app.post('/scss', (req: any, res: any) => {
  const builtInMixins = `
    @mixin fullwidth {
      width: 100vw;
      position: relative;
      left: 50%;
      right: 50%;
      margin-left: -50vw;
      margin-right: -50vw;
    }

    @mixin nogap($position: 'both') {
      @if $position == 'top' {
        margin-top: -2rem;
      } @else if $position == 'bottom' {
        margin-bottom: -2rem;
      } @else if $position == 'both' {
        margin-top: -2rem;
        margin-bottom: -2rem;
      } @else {
        @warn $position + " is not a valid argument";
      }
    }
  `

  let { scss } = req.body

  if (Array.isArray(scss)) {
    let compiledScss = scss.map((item) => {
      const compiled = sass.renderSync({
        data: builtInMixins + item.scss,
        outputStyle: 'compressed',
      })

      return {
        ...item,
        css: compiled.css.toString(),
      }
    })

    res.send({
      css: compiledScss,
    })
  } else {
    sass.render(
      {
        outputStyle: 'compressed',
        data: builtInMixins + scss,
      },
      function (err, result) {
        if (err) {
          res.send({
            error: err,
          })
        } else {
          const css = result.css.toString()
          res.send({
            css,
          })
        }
      }
    )
  }
})

const stripe = require('stripe')(functions.config().stripe.testsecretkey) // HIDE THIS IN A CONFIG VAR
app.post('/stripe/new-subscription', async (req: any, res: any) => {
  let { customerId, email, payment_method } = req.body

  try {
    let customer = {
      id: customerId,
    }

    if (!customer.id) {
      customer = await createNewCustomer(email, payment_method)
    }

    const subscription = await createNewSubscription(customer.id)

    res.send({ subscription, customerId: customer.id })
  } catch (e) {
    res.send(e)
  }
})

async function createNewCustomer(email, payment_method) {
  const customer = await stripe.customers.create({
    payment_method,
    email,
    invoice_settings: {
      default_payment_method: payment_method,
    },
  })
  return customer
}

async function createNewSubscription(customerId) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ plan: 'plan_GsCxDRUJbSwLS4' }],
    expand: ['latest_invoice.payment_intent'],
  })
  return subscription
}

app.post('/stripe/unsubscribe', async (req: any, res: any) => {
  let { subscriptionId } = req.body

  try {
    stripe.subscriptions.del(subscriptionId, function (err, confirmation) {
      res.send(confirmation ? true : false)
    })
  } catch (e) {
    res.send(e)
  }
})

app.post('/notify', async (req) => {
  const { appName, params } = req.body
  sendNotification(appName, params)
})

const mailgun = require('mailgun-js')
app.post('/send-invite', async (req, res) => {
  const { domain, email, role } = req.body
  try {
    const mg = mailgun({
      apiKey: 'b37db7ad181cc5403f2ef563df740121-0afbfc6c-e017ab8a',
      domain: 'mail.primo.so',
    })
    const data = {
      from: 'primo <support@primo.so>',
      to: email,
      subject: `Invitation to collaborate on ${domain}`,
      text: `Hi there. You've been invited to collaborate on a primo site. Lucky you. \nClick this link to accept the invitation: https://primo.so/?a=collab&d=${domain}&e=${email}&r=${role}`,
    }
    mg.messages().send(data, function (error, body) {
      console.log(error)
      if (error) {
        res.send(false)
      } else {
        res.send(true)
      }
    })
  } catch (e) {
    console.error(e)
    res.send(false)
  }
})

import authApp from './firebase/auth'
import firestoreApp from './firebase/firestore'

export const auth = functions.https.onRequest(authApp)
export const firestore = functions.https.onRequest(firestoreApp)
export const primo = functions.https.onRequest(app)
