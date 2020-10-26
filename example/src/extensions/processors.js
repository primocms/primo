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

  if (res.error) {
    res = `<pre class="flex justify-start p-8 items-center bg-red-100 text-red-900 h-screen font-mono text-xs lg:text-sm xl:text-md">${res.error}</pre>`
  }

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