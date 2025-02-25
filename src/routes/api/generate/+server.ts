import { json } from '@sveltejs/kit'
import { html_server } from '../../../compiler/cloud-workers/server-compiler.js'
import postcss from '../../../compiler/cloud-workers/server-postcss.js'

export const POST = async (event) => {
  const { id, code, data, dev_mode } = await event.request.json()

  const css = await postcss(code.css || '')

  let res = null
  try {
    res = await html_server({
      component: {
        id,
        html: code.html,
        css: css,
        js: code.js,
        data
      },
      dev_mode
    })
  } catch (e) {
    console.log(e.message)
    res = {
      html: '',
      css: '',
      js: '',
      head: ''
    }
  }

  return json(res)
}


