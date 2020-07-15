const express = require('express')
const cors = require('cors')({ origin: true })
const app = express()
const bodyParser = require('body-parser')

app.use(cors)

app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send(
    '<ul><li>POST: Compile CSS with PostCSS <strong>/postcss</strong></li></ul>'
  )
})

const autoprefixer = require('autoprefixer')
const postcss = require('postcss')
const precss = require('precss')
const tailwindCSS = require('tailwindcss')
var CleanCSS = require('clean-css')

app.post('/postcss', async (req, res) => {
  let { css, html, options } = req.body
  let { tailwindConfig, includeBase, purge, includeTailwind } = options

  try {
    tailwindConfig = tailwindConfig
      ? new Function(`return ${tailwindConfig}`)()
      : {}
    tailwindConfig = {
      ...tailwindConfig,
      purge: {
        enabled: purge,
        content: [
          {
            raw: html,
            extension: 'html',
          },
        ],
      },
    }
  } catch (e) {
    console.error(e)
    res.send({ error: e })
  }

  const tailwind = tailwindCSS(tailwindConfig)
  const stylesWithTailwind = `\
    ${
      includeBase
        ? `
      @tailwind base;`
        : ``
    }\
    ${
      includeTailwind
        ? `
      @tailwind components;\
      @tailwind utilities;\
    `
        : ''
    }
    
  ${css}`

  postcss([tailwind, precss, autoprefixer])
    .process(stylesWithTailwind, { from: undefined, to: 'styles.css' })
    .then((result) => {
      if (includeTailwind) {
        var output = new CleanCSS({}).minify(result.css)
        res.send(output.styles)
      } else {
        res.send(result.css)
      }

      if (result.map) {
        console.log(result.map)
      }
    })
    .catch((e) => {
      console.error(e)
      res.send({
        error: e.reason,
      })
    })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`primo functions are being served on port ${PORT}`)
})
