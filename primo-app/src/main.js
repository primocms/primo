import App from './App.svelte'
import ComponentPreview from './Preview.svelte'
import MultiPreview from './MultiPreview.svelte'
import SinglePreview from './SinglePreview.svelte'
import {modal} from './node_modules/@stores/app'
import {pageId} from './node_modules/@stores/data/page'

import components from './node_modules/@components'

// const params = new URL(location.href).searchParams;
// const preview = params.get('preview'); 

// let app = {};

// if (!preview) {
//   app = new App({
//     target: document.body
//   });
// } else if (preview === 'single') {
//   const previewId = params.get('page'); 
//   app = new SinglePreview({ 
//     target: document.body,
//     props: {previewId}
//   });
// } else if (preview === 'multiple') {
//   app = new MultiPreview({ target: document.body });
// } else if (preview) {
//   app = new ComponentPreview({ target: document.body });
// }

export default App;

export {
  ComponentPreview,
  MultiPreview,
  SinglePreview,
  modal,
  pageId,
  components
}