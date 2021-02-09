import {customAlphabet} from 'nanoid/non-secure'

export function createUniqueID() {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', 5);
  return nanoid()
}