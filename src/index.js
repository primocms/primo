import Primo from "./Primo.svelte";
import ComponentPreview from './Preview/ComponentPreview.svelte'
import SitePreview from './Preview/SitePreview.svelte'

import {unsaved} from './stores/app/misc'
import {site} from './stores/data/draft'
import savedSite from './stores/data/site'
import dropdown from './stores/app/dropdown'
import activePage from './stores/app/activePage'
import fieldTypes from './stores/app/fieldTypes'
import modal from './stores/app/modal'
import {registerProcessors} from './component'
import { DEFAULTS, createPage, createSite, createNewSite } from './const'
import PrimoFieldTypes from './field-types'

import * as utils from './utils'
import * as components from './components'

const stores = {
  unsaved
}

export {
  savedSite,
  site,
  activePage,
  ComponentPreview,
  SitePreview,
  modal,
  utils,
  components,
  DEFAULTS,
  createPage,
  createSite,
  createNewSite,
  fieldTypes,
  PrimoFieldTypes,
  dropdown,
  stores,
  registerProcessors
}
export default Primo