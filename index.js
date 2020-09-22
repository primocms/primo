import Primo from "./src/App.svelte";
import ComponentPreview from './src/Preview.svelte'
import MultiPreview from './src/MultiPreview.svelte'
import SinglePreview from './src/SinglePreview.svelte'

import dropdown from './src/stores/app/dropdown'
import fieldTypes from './src/stores/app/fieldTypes'
import modal from './src/stores/app/modal'
import site from './src/stores/data/site'
import pageData from './src/stores/data/pageData'
import {pageId} from './src/stores/data/page'
import { DEFAULTS, createPage, createSite } from './src/const'

import * as utils from './src/utils'
import * as components from './src/components'

export {
  ComponentPreview,
  MultiPreview,
  SinglePreview,
  modal,
  pageId,
  utils,
  components,
  site,
  pageData,
  DEFAULTS,
  createPage,
  createSite,
  fieldTypes,
  dropdown
}
export default Primo