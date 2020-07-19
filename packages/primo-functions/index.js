// Libraries for Cloud Functions
const autoprefixer = require('autoprefixer')
const postcss = require('postcss')
const precss = require('precss')
const tailwindCSS = require('tailwindcss')
var CleanCSS = require('clean-css')

function processPostCSS(req, res) {
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
    res.end({ error: e })
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
        res.end(output.styles)
      } else {
        res.end(result.css)
      }

      if (result.map) {
        console.log(result.map)
      }
    })
    .catch((e) => {
      console.error(e)
      res.end(data);
    })
  
}

module.exports = {
  processPostCSS
}