import Primo from "./Primo.svelte";
import ComponentPreview from './Preview.svelte'
// import MultiPreview from './MultiPreview.svelte'
// import SinglePreview from './SinglePreview.svelte'

import functions from './functions'
import {unsaved} from './stores/app/misc'
import {site} from './stores/data/draft'
import dropdown from './stores/app/dropdown'
import fieldTypes from './stores/app/fieldTypes'
import modal from './stores/app/modal'
import {registerProcessors} from './component'
import { DEFAULTS, createPage, createSite } from './const'
import PrimoFieldTypes from './field-types'

import * as utils from './utils'
import * as components from './components'

const stores = {
  unsaved
}

export {
  site,
  ComponentPreview,
  // MultiPreview,
  // SinglePreview,
  modal,
  utils,
  components,
  DEFAULTS,
  createPage,
  createSite,
  fieldTypes,
  PrimoFieldTypes,
  dropdown,
  stores,
  registerProcessors
}
export default Primo