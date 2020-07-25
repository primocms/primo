import Primo from "./src/App.svelte";
import ComponentPreview from './src/Preview.svelte'
import MultiPreview from './src/MultiPreview.svelte'
import SinglePreview from './src/SinglePreview.svelte'

// import Modal from './node_modules/@modal'
import {modal} from './src/node_modules/@stores/app'
import {pageId} from './src/node_modules/@stores/data/page'

export {
  ComponentPreview,
  MultiPreview,
  SinglePreview,
  modal,
  pageId
}
export default Primo