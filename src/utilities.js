import {browser} from '$app/env'
import {customAlphabet} from 'nanoid/non-secure'

export function createUniqueID(length = 5) {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length);
  return nanoid()
}

// https://stackoverflow.com/a/21071454
export function move(array, from, to) {
  if( to === from ) return array;

  var target = array[from];                         
  var increment = to < from ? -1 : 1;

  for(var k = from; k != to; k += increment){
    array[k] = array[k + increment];
  }
  array[to] = target;
  return array;
}


let prettier;
let plugins = {}
export async function formatCode(code, { mode, position }) {
  let formatted
  try {
    // errors in here can crash the app
    if (mode === 'javascript') {
      mode = 'babel'
    }
    if (!prettier && browser) {
      prettier = (await import('prettier'))['default']
      // plugins = await {
      //   'html': (await import('prettier/parser-html'))['default'],
      //   'css': (await import('prettier/parser-postcss'))['default'],
      //   'babel': (await import('prettier/parser-babel'))['default']
      // }
    }
  
    formatted = prettier.formatWithCursor(code, { 
      parser: mode,  
      jsxBracketSameLine: true,
      cursorOffset: position,
      plugins: [
        plugins[mode]
      ]
    })
  } catch(e) {
    console.warn(e)
  }

  return formatted
}