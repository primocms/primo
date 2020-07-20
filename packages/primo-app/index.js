import Primo from "./src/App.svelte";
import ComponentPreview from './src/Preview.svelte'
import MultiPreview from './src/MultiPreview.svelte'
import SinglePreview from './src/SinglePreview.svelte'

// import Modal from './node_modules/@modal'
import {modal} from './src/node_modules/@stores/app'

export {
  ComponentPreview,
  MultiPreview,
  SinglePreview,
  modal
}
export default Primo