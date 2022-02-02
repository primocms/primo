import {customAlphabet} from 'nanoid/non-secure'

export function createUniqueID(length = 5) {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length);
  return nanoid()
}

// https://stackoverflow.com/a/21071454
export function move(array: Array<any>, from: number, to: number) {
  if( to === from ) return array;

  var target = array[from];                         
  var increment = to < from ? -1 : 1;

  for(var k = from; k != to; k += increment){
    array[k] = array[k + increment];
  }
  array[to] = target;
  return array;
}

export function replaceDashWithUnderscore(str) {
  return str.replace(/-/g, '_').replace(/ /g, '_').toLowerCase();
}