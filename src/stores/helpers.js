import _ from 'lodash'
import {get} from 'svelte/store'
import { fields as siteFields } from './data/draft'
import { fields as pageFields } from './app/activePage'
import {symbols} from './data/draft'

export function getAllFields(component = null) {
  let componentFields = []
  if (component) {
    componentFields = component.value.raw.fields;
  }
  const allFields = _.unionBy(componentFields, get(pageFields), get(siteFields), "key");
  return allFields
}

export function getSymbol(symbolID) {
   return _.find(get(symbols), ['id', symbolID]);
}