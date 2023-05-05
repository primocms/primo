import { customAlphabet } from 'nanoid/non-secure'

export function createUniqueID(length = 5) {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length);
  return nanoid()
}

// https://stackoverflow.com/a/21071454
export function move(array, from, to) {
  if (to === from) return array;

  var target = array[from];
  var increment = to < from ? -1 : 1;

  for (var k = from; k != to; k += increment) {
    array[k] = array[k + increment];
  }
  array[to] = target;
  return array;
}

export function replaceDashWithUnderscore(str) {
  return str.replace(/-/g, '_').replace(/ /g, '_').toLowerCase();
}

export function validate_url(url) {
  return url
    .replace(/\s+/g, '-')
    .replace(/[^0-9a-z\-._]/gi, '')
    .toLowerCase()
}

export function content_editable(element, params) {
  let value = element.textContent
  element.contentEditable = true
  element.spellcheck = false

  element.onfocus = () => {
    const range = document.createRange()
    const sel = window.getSelection()
    range.setStart(element, 1)
    range.collapse(true)

    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  if (params.autofocus) element.focus()

  element.onkeydown = (e) => {
    if (e.code === 'Enter') {
      e.preventDefault()
      e.target?.blur()
      params.on_submit(value)
    }
  }

  element.onkeyup = (e) => {
    value = e.target.textContent
    params.on_change(value)
  }
}