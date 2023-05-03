import Primo from "./Primo.svelte";

import {saved,onMobile,userRole} from './stores/app/misc'
import {site, content} from './stores/data/site'
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
  stores,
  registerProcessors,
  buildStaticPage
}
export default Primo