import Primo from "./src/App.svelte";
import ComponentPreview from './src/Preview.svelte'
import MultiPreview from './src/MultiPreview.svelte'
import SinglePreview from './src/SinglePreview.svelte'

import {unsaved} from './src/stores/app/misc'
import {site} from './src/stores/data/draft'
import dropdown from './src/stores/app/dropdown'
import fieldTypes from './src/stores/app/fieldTypes'
import modal from './src/stores/app/modal'
import { DEFAULTS, createPage, createSite } from './src/const'

import * as utils from './src/utils'
import * as components from './src/components'

const stores = {
  unsaved
}

export {
  site,
  ComponentPreview,
  MultiPreview,
  SinglePreview,
  modal,
  utils,
  components,
  DEFAULTS,
  createPage,
  createSite,
  fieldTypes,
  dropdown,
  stores
}
export default Primo