// Libraries for Cloud Functions
const autoprefixer = require('autoprefixer')
const postcss = require('postcss')
const precss = require('precss')
const tailwindCSS = require('tailwindcss')
var CleanCSS = require('clean-css')

async function processPostCSS(css, html, options, onsuccess) {
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
    return ''
    // res.end({ error: e })
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

  try {
    const result = await postcss([tailwind, precss, autoprefixer])
      .process(stylesWithTailwind, { from: undefined, to: 'styles.css' })
      .catch((e) => {
        console.error(e)
        // res.end(data);
      })

    if (result) {
      if (includeTailwind) {
        var output = new CleanCSS({}).minify(result.css)
        return output.styles
      } else {
        return result.css
      }
    } else {
      return ''
    }
  } catch(e) {
    console.log('PostCSS error')
    console.error(e)
    return ''
  }

}

const fs = require('fs')
const prettier = require("prettier");
const _ = require('lodash')

async function buildSite({ pages, siteStyles }) {
  fs.mkdir('./build', { recursive: true }, (err) => {
    if (err) throw err;
  });

  const siteCSS = siteStyles.final
  const formattedSiteCSS = prettier.format(siteCSS, { parser: 'css' })
  fs.writeFile(`./build/styles.css`, formattedSiteCSS, (err) => {
    if (err) throw err 
  })

  pages.forEach(async page => {
    const HTML = buildPageHTML(page)
    const formattedHTML = prettier.format(HTML, { parser: 'html' })
    fs.writeFile(`./build/${page.id}.html`, formattedHTML, (err) => {
      if (err) throw err 
    })

    const CSS = await buildPageCSS(page.content, HTML, siteStyles.raw + page.styles.raw, siteStyles.tailwind)
    const formattedCSS = prettier.format(CSS, { parser: 'css' })
    fs.writeFile(`./build/${page.id}.css`, formattedCSS, (err) => {
      if (err) throw err 
    })
  })

  function buildPageHTML({ id, title, content, dependencies, styles }) {
    let html = ''
    content.forEach(section => {
      html += `<section id="section-${section.id}">\n` +
                `\t<div class="columns flex flex-wrap ${section.width === 'contained' ? 'container' : ''}">\n`
      section.columns.forEach(column => {
        html += `\t\t<div class="column ${column.size}" id="column-${column.id}">\n`
        column.rows.forEach(row => {
          html += row.type === 'component' 
                  ? `\t\t\t<div class="primo-component">\n` +
                      `\t\t\t\t<div id="component-${row.id}" class="w-full">${row.value.final.html}</div>\n` +
                      `\t\t\t\t<script>${row.value.final.js}</script>\n` + 
                    `\t\t\t</div>\n`
                  : `\t\t\t<div class="primo-content">\n` +
                      `\t\t\t\t${row.value.html}\n` + 
                    `\t\t\t</div>\n`
        })
        html += `\t\t</div>\n`
      })
      html += `\t</div>\n` +
            `</section>\n`
    })

    var regex = /href=(['"])\/([\S]+)(\1)[^>\s]*/g;
    html = html.replace(regex, "href='/$2.html'")

    return `
      <!doctype html>

      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${ title }</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" type="text/css" href="./styles.css" />
        <link rel="stylesheet" type="text/css" href="./${id}.css" />
        <script src="./${id}.js"></script>
        `+
        `${dependencies.headEmbed}
      </head>
      <body data-instant-intensity="all" class="primo-page">   
        ${html}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/instant.page/5.1.0/instantpage.js" integrity="sha256-DdSiNPR71ROAVMqT6NiHagLAtZv9EHeByYuVxygZM5g=" crossorigin="anonymous"></script>
      </body>
      </html>
    `
  }

  async function buildPageCSS(content, HTML, rawCSS, tailwindConfig) {

    const components = _.flatMapDeep(content, (section) => section.columns.map(column => column.rows.filter(row => row.type === 'component')))
    const componentStyles = components.map(component => `#component-${component.id} {${component.value.raw.css}}`).join('\n')

    const allStyles = rawCSS + componentStyles

    const pageStyles = await processPostCSS(
      allStyles, 
      HTML, 
      { 
        includeBase: true,
        includeTailwind: true,
        purge: true,
        tailwindConfig
      }
    )

    return pageStyles

  }
}

module.exports = {
  processPostCSS,
  buildSite
}