import { get } from 'svelte/store'
import { convertFieldsToData, parseHandlebars } from '../../utils'


export function setHeadScript(js) {
  document
    .querySelector('head')
    .insertAdjacentHTML('beforeend', `<div id="primo--javascript"></div>`)
  document
    .querySelector('head')
    .insertAdjacentHTML('beforeend', `<div id="primo--custom-scripts"></div>`)
  document
    .querySelector('head')
    .insertAdjacentHTML('beforeend', `<div id="primo--head-embeds"></div>`)
  updateHeadScript(js)
}

export function updateHeadScript(js) {
  appendHtml(
    '#primo--javascript',
    'script',
    `try {${js}} catch(e) { console.log('Error with JavaScript'); console.error(e) }`
  )
}

export function getHeadStyles(css) {
  return `<style id="primo--global-styles">${css}</style>`
}

export function setCustomScripts(scripts, mounted) {
  if (mounted) {
    document.querySelector('#primo--custom-scripts').innerHTML = ''
    scripts.forEach((script) => {
      let s = document.createElement('script')
      s.type = 'text/javascript'
      s.src = script.src
      s.async = true
      s.defer = true
      s.crossOrigin = 'anonymous'
      document.querySelector('#primo--custom-scripts').appendChild(s)
    })
  }
}

export function getPageLibraries(libraries) {
  return libraries.map(
    (library) => `<link href="${library.src}" rel="stylesheet" />`
  )
}

export function setPageJsLibraries(libraries, mounted) {
  if (mounted) {
    libraries.forEach((library) => {
      setPageJsLibrary(library)
    })
  }
}

function setPageJsLibrary(library) {
  const makeValid = (string) =>
    string.replace(/[!\"#$%&'\(\)\*\+,\.\/:;<=>\?\@\[\\\]\^`\{\|\}~]/g, '')
  const libraryName = makeValid(library.name)
  document
    .querySelector('head')
    .insertAdjacentHTML('beforeend', `<div id="library--${libraryName}"></div>`)
  appendHtml(`#library--${libraryName}`, 'script', '', {
    src: library.src,
  })
}

export function getStyles(styles) {
  return `<style>${styles}</style>`
}

export function appendHtml(selector, elementTag, content, attributes = {}) {
  let container = document.querySelector(selector)
  container.innerHTML = ''
  var element = document.createElement(elementTag)
  Object.entries(attributes).forEach((attribute) => {
    let [name, value] = attribute
    element[name] = value
  })
  var contentElement = document.createTextNode(content)
  element.appendChild(contentElement)
  container.appendChild(element)
}
