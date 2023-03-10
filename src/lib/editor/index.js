import Primo from "./Primo.svelte";

import {saved,onMobile,userRole} from './stores/app/misc'
import {site, content} from './stores/data/draft'
import savedSite from './stores/data/site'
import dropdown from './stores/app/dropdown'
import activePage from './stores/app/activePage'
import fieldTypes from './stores/app/fieldTypes'
import modal from './stores/app/modal'
import {buildStaticPage} from './stores/helpers'
import {registerProcessors} from './component'
import { Page, Site } from './const'
import PrimoFieldTypes from './field-types'

import * as utils from './utils'
import * as components from './components'

const stores = {
  saved,
  onMobile,
  userRole
}

export {
  savedSite,
  site,
  content,
  activePage,
  modal,
  utils,
  components,
  Page,
  Site,
  fieldTypes,
  PrimoFieldTypes,
  dropdown,
  stores,
  registerProcessors,
  buildStaticPage
}
export default Primo