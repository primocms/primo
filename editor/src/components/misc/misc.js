export const iframePreview = (locale = 'en') => `
  <!DOCTYPE html>
  <html lang="${locale}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        let c;

        function update(source = null, props) {
          if (c && !source && props) {
            c.$set(props);
          } else if (source) {
            const blob = new Blob([source], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
  
            import(url).then(({ default: App }) => {
              if (c) c.$destroy();
              try {
                c = new App({ 
                  target: document.body,
                  props
                })
              } catch(e) {
                document.body.innerHTML = ''
                console.error(e.toString())
              }
            })
          }
        }

        window.addEventListener('message', ({data}) => {
          if (data.componentApp || data.componentData) {
            update(data.componentApp, data.componentData)
          }
        }, false)
		  <\/script>
    </head>
    <body class="primo-page">
    </body>
  </html>
`

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
    <body class="primo-page">
    </body>
    <style>
        .primo-page {
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
    <body class="primo-page">
    </body>
    <style>
        .primo-page {
          /* height: 100vh;
          overflow: hidden; */
        }
    </style>
  </html>
`