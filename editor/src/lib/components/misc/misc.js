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
          const { event, payload = {} } = data
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
              const primoError = console ? console.error.bind(console) : null;
              function postMessage(logs) {
                channel.postMessage({
                  event: 'SET_CONSOLE_LOGS',
                  payload: { logs }
                });
              }
              channel.postMessage({ event: 'BEGIN' });
              if (primoLog) console.log = (...args) => { try {postMessage(...args)}catch(e){postMessage('Could not print ' + typeof(args) + '. See in console.')}; primoLog(...args); };
              if (primoLog) console.error = (...args) => { try {postMessage(...args)}catch(e){postMessage('Could not print ' + typeof(args) + '. See in console.')}; primoError(...args); };
              \` + source;
            const blob = new Blob([withLogs], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            import(url).then(({ default: App }) => {
              if (c) c.$destroy();
              try {
                c = new App({ 
                  target: document.querySelector('.section > .component'),
                  props
                })
                setTimeout(setListeners, 200)
              } catch(e) {
                document.querySelector('.section > .component').innerHTML = ''
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
          // Move site+page styles to top of html head to cascade correctly
          const head = document.getElementsByTagName('head')[0]
          head.prepend(document.getElementById('parent-styles'))
        }
		  <\/script>
    </head>
    <body id="page">
        <div class="section has-component">
          <div class="component">
          </div>
        </div>
    </body>
  </html>
`

export const componentPreview = (code) => {

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>${code.head}</head>
      <body id="page">
        ${code.html}
        <style>${code.css}</style>
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
    <body id="page">
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
    <body id="page">
    </body>
    <style>
        .page {
          /* height: 100vh;
          overflow: hidden; */
        }
    </style>
  </html>
`