import {ComponentPreview,MultiPreview,SinglePreview} from '../../index'

let app
const isMultiPreview = window.location.pathname.includes('multi')
const params = new URL(window.location.href).searchParams
const preview = params.get('preview')
const previewId = params.get('page')

if (preview === 'multiple') {
	app = new MultiPreview({
		target: document.body
	});
} else if (preview === 'single' && previewId) {
  app = new SinglePreview({
    target: document.body,
    props: { previewId },
  })
} else if (preview === 'single') {
	app = new ComponentPreview({
		target: document.body
	});
} else {
	console.error('could not load preview')
}


export default app;