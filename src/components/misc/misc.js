export const iframePreview = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        let c;

        function update(source = null, props) {
          if (c) {
            c.$set(props);
            return
          }

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

        window.addEventListener('message', ({data}) => {
          console.log({data})
          if (data.componentApp) {
            update(data.componentApp, data.props)
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
          console.log({source})
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