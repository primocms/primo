import axios from 'axios'

let Handlebars;
export async function handlebars(code, data) {
  console.log('data', data)
  if (!Handlebars) {
    Handlebars = await import("handlebars/dist/handlebars.min.js");
  }
  let res 
  try {
    const template = Handlebars.compile(code);
    res = template(data);
  } catch(e) {
    const error = e.toString().replace(/\n/g, "<br />")
    res = `<pre class="flex justify-start p-8 items-center bg-red-100 text-red-900 h-screen font-mono text-xs lg:text-sm xl:text-md">${error}</pre>`
  }
  console.log('res', res)
  return res
}

let cachedCSS = ''
export async function postCSS(raw, options) {
  console.log({raw,options})
  const {data} = await axios.post('http://localhost:3005/__fn/postcss', {raw,options})
  if (data.error) {
    console.error(data.error)
    return cachedCSS
  } else {
    cachedCSS = data
    return data
  }
}