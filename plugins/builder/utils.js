import _ from 'lodash'

const boilerplate = (page, html) => {
  const {libraries} = page.dependencies
  const headEmbed = page.wrapper.final.head
  return `
    <!doctype html>

    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" type="text/css" href="./styles.css" />
      <link rel="stylesheet" type="text/css" href="./${page.id}.css" />
      <script src="./${page.id}.js"></script>
      ${
        libraries.length > 0 
        ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.1/system.min.js" integrity="sha256-15j2fw0zp8UuYXmubFHW7ScK/xr5NhxkxmJcp7T3Lrc=" crossorigin="anonymous"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.2/extras/use-default.min.js" integrity="sha256-uVDULWwA/sIHxnO31dK8ThAuK46MrPmrVn+JXlMXc5A=" crossorigin="anonymous"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.3.2/extras/amd.min.js" integrity="sha256-7vS4pPsg7zx1oTAJ1zQIr2lDg/q8anzUCcz6nxuaKhU=" crossorigin="anonymous"></script>
          <script type="systemjs-importmap">${JSON.stringify({"imports": _.mapValues(_.keyBy(libraries.filter(l => l.src.slice(-5).includes('.js')), 'name'), 'src')})}</script>`
        : ``
      }
      `+
      `${headEmbed}
    </head>

    <body data-instant-intensity="all" class="primo-page">   
      ${html}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/instant.page/5.1.0/instantpage.js" integrity="sha256-DdSiNPR71ROAVMqT6NiHagLAtZv9EHeByYuVxygZM5g=" crossorigin="anonymous"></script>
    </body>
    </html>
  `
}

export function buildPageHTML(page, buildWholePage = false) {
  const { content } = page 
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

  return boilerplate(page, html)
}

export async function buildPageStyles(page, site, HTML) {
  const tailwind = JSON.stringify(getCombinedTailwindConfig(page.styles.tailwind, site.styles.tailwind))
  const combinedCSS = site.styles.raw + page.styles.raw
  return await buildPageCSS(page.content, HTML, combinedCSS, tailwind)
}

export async function buildPageCSS(content, HTML, rawCSS, tailwindConfig) {

  const components = _.flatMapDeep(content, (section) => section.columns.map(column => column.rows.filter(row => row.type === 'component')))
  const componentStyles = components.map(component => `#component-${component.id} {${component.value.raw.css}}`).join('\n')

  const allStyles = rawCSS + componentStyles

  const pageStyles = await processStyles(
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

export async function processStyles(css, html, options = {}) {
  try {
    const result = await processPostCSS(css, html, options)
    if (result.error) {
      console.error(result.error)
      return '';
    } else {
      return result;
    }
  } catch(e) {
    console.error(e)
  }
}

export function getCombinedTailwindConfig(pageTailwindConfig, siteTailwindConfig) {
  let siteTailwindObject
  let pageTailwindObject
  try {
    const siteTW = siteTailwindConfig
    siteTailwindObject = new Function(`return ${siteTW}`)() // convert string object to literal object
    pageTailwindObject = new Function(`return ${pageTailwindConfig}`)()
    return _.merge(siteTailwindObject, pageTailwindObject)
  } catch(e) {
    console.error(e)
    return {}
  }
}