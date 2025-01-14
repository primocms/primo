export const dynamic_iframe_srcdoc = (head = '') => {
  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      ${head}
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        let c;

        const channel = new BroadcastChannel('component_preview');
        channel.onmessage = ({data}) => {
          const { event, payload = {} } = data
          if (payload.componentApp || payload.data) {
            update(payload.componentApp, payload.data)
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
                  target: document.querySelector('#page'),
                  props
                })
                // setTimeout(setListeners, 1000)
              } catch(e) {
                document.querySelector('#page').innerHTML = ''
                console.error(e.toString())
                channel.postMessage({
                  event: 'SET_ERROR',
                  payload: {
                    error: e.toString()
                  }
                });
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
    <body id="page"></body>
  </html>
`}

export const static_iframe_srcdoc = ({ head = '', html, css, foot }) => {
	return `
    <!DOCTYPE html>
    <html lang="en">
      <head>${head}</head>
      <body id="page" style="margin:0">
        ${html}
        <style>${css}</style>
        ${foot}
      </body>
    </html>
  `
}

export const component_iframe_srcdoc = ({ head = '', css = '', foot = '' }) => {
	return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <script type="module">
          let c;

          window.addEventListener('message', ({data}) => {
            // handle the message here
            const { payload } = data
            if (payload.js || payload.data) {
              update(payload.js, payload.data)
            }
          })

          function update(source = null, props) {
            if (c && !source && props) {
              // TODO: re-render component when passing only a subset of existing props (i.e. when a prop has been deleted)
              c.$set(props);
            } else if (source) {
              const blob = new Blob([source], { type: 'text/javascript' });
              const url = URL.createObjectURL(blob);
              import(url).then(({ default: App }) => {
                if (c) {
                  c.$destroy();
                }
                try {
                  c = new App({ 
                    target: document.querySelector('#component'),
                    props
                  })
                  // setTimeout(setListeners, 1000)
                } catch(e) {
                  document.querySelector('#page').innerHTML = ''
                  console.error(e.toString())
                  // channel.postMessage({
                  //   event: 'SET_ERROR',
                  //   payload: {
                  //     error: e.toString()
                  //   }
                  // });
                }
                // channel.postMessage({
                //   event: 'SET_HEIGHT',
                //   payload: {
                //     height: window.document.body.scrollHeight
                //   }
                // });
              })
            }
          }
        </script>
        ${head}
      </head>
      <body id="page" style="margin:0;overflow:hidden;">
        <div id="component"></div>
        <style>${css}</style>
        ${foot}
        <style>
          [contenteditable="true"] { outline: 0 !important; }
        </style>
      </body>
    </html>
  `
}
