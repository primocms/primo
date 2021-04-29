import App from './Primo.svelte'

const app = new App({
  target: document.body,
  props: {
    foo: 'bar'
  }
})

export default app
