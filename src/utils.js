import _ from "lodash";
import { getAllFields } from './stores/helpers'
import { processors } from './component'

export async function processCode(precompiled, data) {
  const res = await processors.html(precompiled, data)
  return res
}

export function convertFieldsToData(fields) {
  const parsedFields = fields.map((field) => {
    if (field.type === "group") {
      if (field.fields) {
        field.value = _.chain(field.fields)
          .keyBy("key")
          .mapValues("value")
          .value();
      }
    }
    return field;
  })


  return _.chain(parsedFields).keyBy("key").mapValues("value").value()
}

export async function updateHtmlWithFieldData(rawHTML) {
  const allFields = getAllFields();
  const data = await convertFieldsToData(allFields, 'all');
  const finalHTML = await processors.html({
    html: rawHTML,
    css: '',
    js: ''
  }, data);
  return finalHTML;
}

// Lets us debounce from reactive statements
export function createDebouncer(time) {
  return _.debounce((val) => {
    const [fn, arg] = val;
    fn(arg);
  }, time);
}

export function createSymbolPreview({ id, wrapper, html, css, js, tailwind }) {
  const twConfig = JSON.stringify({
    mode: 'silent',
    theme: tailwind.theme
  })

  if (wrapper) {
    return `<html hidden>
      <script type="module" src="https://cdn.skypack.dev/twind/shim"></script>
      <script type="twind-config">
        ${twConfig}
      </script>
      <head>${wrapper.head.final}</head>
      <div id="component-${id}">${html}</div>
      <style>${css}</style>
      <script type="module">${js}</script>
      ${wrapper.below.final}`;
  } else {
    return `<html hidden>
      <script type="module" src="https://cdn.skypack.dev/twind/shim"></script>
      <script type="twind-config">
        ${twConfig}
      </script>
      <div id="component-${id}">${html}</div>
      <style>${css}</style>
      <script type="module">${js}</script>`;
  }
}

export function wrapInStyleTags(css, id = null) {
  return `<style type="text/css" ${id ? `id = "${id}"` : ""}>${css}</style>`;
}

export function buildPagePreview(content, tailwind) {
  let html = "";
  for (let block of content) {
    if (block.type === 'component') {
      html += `
      <div class="block" id="block-${block.id}">
        <div class="primo-component" id="component-${block.id}">
          <div>${block.value.final.html}</div>
          <script type="module">${block.value.final.js}</script>
        </div>
      </div>
      `
    } else if (block.type === 'content') {
      html += `
        <div class="block" id="block-${block.id}">
          <div class="primo-copy" id="copy-${block.id}">
            ${block.value.html}
          </div>
        </div>
      `
    }
  }

  const twConfig = JSON.stringify({
    mode: 'silent',
    theme: tailwind.theme
  })

  html += `<script type="module" src="https://cdn.skypack.dev/twind/shim"></script>
  <script type="twind-config">
    ${twConfig}
  </script>`

  // html += get(site).styles // TODO

  return `<html hidden>${html}</html>`;
}

// make a url string valid
export const makeValidUrl = (str = '') => {
  if (str) {
    return str.replace(/\s+/g, '-').replace(/[^0-9a-z\-._]/ig, '').toLowerCase()
  } else {
    return ''
  }
}