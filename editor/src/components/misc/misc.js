export const iframePreview = (locale = 'en') => `
  <!DOCTYPE html>
  <html lang="${locale}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        let c;

        const channel = new BroadcastChannel('component_preview');
        channel.onmessage = ({data}) => {
          const { event, payload } = data
          if (payload.componentApp || payload.componentData) {
            update(payload.componentApp, payload.componentData)
          }
        }

        function update(source = null, props) {
          if (c && !source && props) {
            // TODO: re-render component when passing only a subset of existing props (i.e. when a prop has been deleted)
            c.$set(props);
          } else if (source) {
            const withLogs = \`
            const channel = new BroadcastChannel('component_preview');
            const primoLog = console ? console.log.bind(console) : null;
            function postMessage(logs) {
              channel.postMessage({
                event: 'SET_CONSOLE_LOGS',
                payload: { logs }
              });
            }
            if (primoLog) console.log = (...args) => { postMessage(...args); primoLog(...args); };\` + source;
            const blob = new Blob([withLogs], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            import(url).then(({ default: App }) => {
              if (c) c.$destroy();
              try {
                c = new App({ 
                  target: document.body,
                  props
                })
                setTimeout(setListeners, 200)
              } catch(e) {
                document.body.innerHTML = ''
                console.error(e.toString())
              }
              channel.postMessage({
                event: 'SET_HEIGHT',
                payload: {
                  height: window.document.body.scrollHeight
                }
              });
            })
          }
        }

        function setListeners() {
          document.body.querySelectorAll('*').forEach(el => {
            el.addEventListener('mouseenter', () => {
              const loc = el?.__svelte_meta?.loc // line of code
              channel.postMessage({
                event: 'SET_ELEMENT_PATH',
                payload: { loc }
              });
            })
          })
        }
		  <\/script>
    </head>
    <body class="page">
    </body>
  </html>
`

export const componentPreview = (js, data) => {

  const blob = new Blob([js], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head></head>
      <body class="page">
        <main></main>
        <script type="module" async>
          const { default:App } = await import('${url}')
          new App({ 
            target: document.querySelector('main'),
            props: ${JSON.stringify(data)} 
          })
        </script>
      </body>
    </html>
  `
}

export const pagePreview = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        let c;

        function update(source) {
          source.forEach(async (item, i) => {
            if (item.svelte.error) return
            const div = document.createElement("div")
            document.body.appendChild(div)
            const blob = new Blob([item.svelte], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const { default:App } = await import(url)
            new App({ target: div })
          })
        }

        window.addEventListener('message', ({data}) => {
          update(data.preview)
        }, false)
		  <\/script>
    </head>
    <body class="page">
    </body>
    <style>
        .page {
          /* height: 100vh;
          overflow: hidden; */
        }
    </style>
  </html>
`


export const currentPagePreview = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        window.addEventListener('message', ({data}) => {
          document.querySelector('body').innerHTML = data.html
        }, false)
		  <\/script>
    </head>
    <body class="page">
    </body>
    <style>
        .page {
          /* height: 100vh;
          overflow: hidden; */
        }
    </style>
  </html>
`