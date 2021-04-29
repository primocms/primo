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
let plugin;
export async function formatCode(code, mode) {
  if (!prettier) {
    prettier = (await import('prettier'))['default']
    plugin = await {
      'html': import('prettier/parser-html'),
      'css': import('prettier/parser-postcss'),
      'javascript': import('prettier/parser-babel')
    }[mode]
  }

  let formatted = code

  try {
    formatted = prettier.format(code, { 
      parser: mode,  
      jsxBracketSameLine: true,
      plugins: [plugin]
    })
  } catch(e) {
    console.warn(e)
  }

  return formatted
}