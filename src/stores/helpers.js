import _ from 'lodash'
import {get} from 'svelte/store'
import { fields as siteFields, styles as pageStyles } from './data/draft'
import { fields as pageFields, styles as siteStyles } from './app/activePage'
import {getCombinedTailwindConfig} from './data/tailwind'
import {symbols} from './data/draft'

export function getAllFields(componentFields = []) {
  const allFields = _.unionBy(componentFields, get(pageFields), get(siteFields), "key");
  return allFields
}

export function getSymbol(symbolID) {
   return _.find(get(symbols), ['id', symbolID]);
}

export function getTailwindConfig() {
  const { tailwind:pageTW } = get(pageStyles)
  const { tailwind:siteTW } = get(siteStyles)
  const combined = getCombinedTailwindConfig(pageTW, siteTW)
  let asObj = {}
  try {
    asObj = new Function(`return ${combined}`)()
  } catch(e) {
    console.warn(e)
  }
  return asObj
}