import axios from 'axios'
import PromiseWorker from 'promise-worker';
const postCSSWorker = new Worker('./processors/postcss.worker.js');
const cssPromiseWorker = new PromiseWorker(postCSSWorker);

const handlebarsWorker = new Worker('./processors/handlebars.worker.js');
const htmlPromiseWorker = new PromiseWorker(handlebarsWorker);


export async function html(code, data) {
  let res = await htmlPromiseWorker.postMessage({
    code,
    data
  })

  return res
}

let cachedCSS = ''

export async function css(raw, options) {
  const config = Function(`return ${options.tailwind}`)()

  const res = await cssPromiseWorker.postMessage({
    css: raw,
    config
  })

  return res
}