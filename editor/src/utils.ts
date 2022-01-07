import _ from "lodash-es";
import { processors } from './component'
export async function processCode({ code, data = {}, buildStatic = true, format = 'esm'}: { code:any, data:object, buildStatic?:boolean, format?:string}) {
  const {css,error} = await processors.css(code.css || '')
  if (error) {
    return {error}
  }
  const res = await processors.html({
    code: {
      ...code,
      css,
    }, data, buildStatic, format
  })
  return res
}

export async function processCSS(raw: string): Promise<string> {
  const {css,error} = await processors.css(raw)
  if (error) {
    console.log('CSS Error:', error)
    return raw
  }
  return css
}

export function convertFieldsToData(fields: any[]): object {
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

  if (!parsedFields.length) return {}

  return _.chain(parsedFields).keyBy("key").mapValues("value").value()
}

// Lets us debounce from reactive statements
export function createDebouncer(time) {
  return _.debounce((val) => {
    const [fn, arg] = val;
    fn(arg);
  }, time);
}

export function wrapInStyleTags(css: string, id:string = null): string {
  return `<style type="text/css" ${id ? `id = "${id}"` : ""}>${css}</style>`;
}

// make a url string valid
export const makeValidUrl = (str:string = ''): string => {
  if (str) {
    return str.replace(/\s+/g, '-').replace(/[^0-9a-z\-._]/ig, '').toLowerCase()
  } else {
    return ''
  }
}