export const iframePreview = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        let c;

        function update(source) {
          console.log({source})
          const blob = new Blob([source], { type: 'text/javascript' });
          const url = URL.createObjectURL(blob);

          import(url).then(({ default: App }) => {
            if (c) c.$destroy();
            c = new App({ target: document.body })
          })
        }

        window.addEventListener('message', ({data}) => {
          update(data.componentApp)
        }, false)
		  <\/script>
    </head>
    <body class="primo-page">
    </body>
  </html>
`