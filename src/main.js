import App from './App.svelte'
import ComponentPreview from './Preview.svelte'
import MultiPreview from './MultiPreview.svelte'
import SinglePreview from './SinglePreview.svelte'

const { hostname:domain } = window.location
const subdomain = domain.split('.')[0]

const params = new URL(location.href).searchParams;
const preview = params.get('preview'); 
const action = params.get('a')
let app;

if (!preview) {
  app = new App({
    target: document.body,
    props: {
      subdomain
    }
  });
} else if (preview === 'single') {
  const previewId = params.get('page'); 
  app = new SinglePreview({ 
    target: document.body,
    props: {previewId}
  });
} else if (preview === 'multiple') {
  app = new MultiPreview({ target: document.body });
} else if (preview) {
  app = new ComponentPreview({ target: document.body });
}

export default app;