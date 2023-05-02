import _, { chain as _chain, capitalize as _capitalize } from "lodash-es";
import { processors } from './component'
import { LoremIpsum as lipsum } from "lorem-ipsum/src";
import showdown from '$lib/editor/libraries/showdown/showdown.min.js'
import showdownHighlight from 'showdown-highlight'
export const converter = new showdown.Converter({
  extensions: [showdownHighlight()],
})

const componentsCache = new Map();
export async function processCode({ component, buildStatic = true, format = 'esm', locale = 'en', hydrated = true, ignoreCachedData = false }) {
  let css = ''
  if (component.css) {
    css = await processCSS(component.css || '')
  }

  const cacheKey = ignoreCachedData ? JSON.stringify({
    component: Array.isArray(component) ? component.map(c => ({ html: c.html, css: c.css, head: c.head })) : {
      head: component.head,
      html: component.html,
      css: component.css
    },
  }) : JSON.stringify({
    component,
    format,
    buildStatic,
    hydrated
  })

  if (componentsCache.has(cacheKey)) {
    return componentsCache.get(cacheKey)
  }

  const res = await processors.html({
    component: {
      ...component,
      css
    }, buildStatic, format, locale, hydrated
  })

  componentsCache.set(cacheKey, res)

  return res
}

const cssCache = new Map();
export async function processCSS(raw) {
  if (cssCache.has(raw)) {
    return cssCache.get(raw)
  }

  const res = await processors.css(raw) || {}
  if (!res) {
    return ''
  } else if (res.error) {
    console.log('CSS Error:', res.error)
    return raw
  } else if (res.css) {
    cssCache.set(raw, res.css)
    return res.css
  }
}

// Lets us debounce from reactive statements
export function createDebouncer(time) {
  return _.debounce((val) => {
    const [fn, arg] = val;
    fn(arg);
  }, time);
}

export function wrapInStyleTags(css, id) {
  return `<style type="text/css" ${id ? `id = "${id}"` : ""}>${css}</style>`;
}

// make a url string valid
export const makeValidUrl = (str = '') => {
  if (str) {
    return str.replace(/\s+/g, '-').replace(/[^0-9a-z\-._]/ig, '').toLowerCase()
  } else {
    return ''
  }
}


const lorem = new lipsum({
  sentencesPerParagraph: {
    max: 8,
    min: 4
  },
  wordsPerSentence: {
    max: 16,
    min: 4
  }
});
export const LoremIpsum = (nSentences = 1) => {
  return lorem.generateSentences(nSentences)
}

export function getPlaceholderValue(field) {
  if (field.default) return field.default
  if (field.type === 'repeater') return getRepeaterValue(field.fields)
  else if (field.type === 'group') return getGroupValue(field)
  else if (field.type === 'image') return {
    url: 'https://picsum.photos/600/400?blur=10',
    src: 'https://picsum.photos/600/400?blur=10',
    alt: '',
    size: null
  }
  else if (field.type === 'text') return _capitalize(lorem.generateWords(3))
  else if (field.type === 'markdown' || field.type === 'content') return {
    html: converter.makeHtml(`# This is some markdown`),
    markdown: `# This is some markdown`
  }
  else if (field.type === 'link') return {
    label: lorem.generateWords(1),
    url: '/'
  }
  else if (field.type === 'url') return '/'
  else {
    console.warn('No placeholder set for field type', field.type)
    return ''
  }

  function getRepeaterValue(subfields) {
    return Array.from(Array(2)).map(_ => _chain(subfields).map(s => ({ ...s, value: getPlaceholderValue(s) })).keyBy('key').mapValues('value').value())
  }

  function getGroupValue(field) {
    return _chain(field.fields).keyBy('key').mapValues((field) => getPlaceholderValue(field)).value()
  }
}

export function getEmptyValue(field) {
  if (field.default) return field.default
  if (field.type === 'repeater') return []
  else if (field.type === 'group') return getGroupValue(field)
  else if (field.type === 'image') return {
    url: '',
    src: '',
    alt: '',
    size: null
  }
  else if (field.type === 'text') return ''
  else if (field.type === 'markdown') return { html: '', markdown: '' }
  else if (field.type === 'link') return {
    label: '',
    url: ''
  }
  else if (field.type === 'url') return ''
  else {
    console.warn('No placeholder set for field type', field.type)
    return ''
  }

  function getGroupValue(field) {
    return _chain(field.fields).keyBy('key').mapValues((field) => getPlaceholderValue(field)).value()
  }
}