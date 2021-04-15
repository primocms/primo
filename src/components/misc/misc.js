export const iframePreview = `
  <!DOCTYPE html>
  <html hidden>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style id="_style"></style>
      <script type="module" id="_script"></script>
      <script>
        window.addEventListener('message', ({data}) => {
          const {html, css, js, tailwind} = data
          if (html) {
            setHTML(data.html)
          }
          if (css) {
            setCSS(css)
          }
          if (js) {
            setJS(js)
          }
          if (tailwind) {
            setTW(tailwind)
          }
        })
        function setHTML(html) {
          document.body.innerHTML = html
        }
        function setCSS(css) {
          const style = document.getElementById('_style')
          const newStyle = document.createElement('style')
          newStyle.id = '_style'
          newStyle.innerHTML = css
          style.parentNode.replaceChild(newStyle, style)
        }
        function setJS(js = '') {
          const script = document.getElementById('_script')
          if (Array.isArray(js)) {
            for (let blockJS of js) {
              const newScript = document.createElement('script')
              newScript.innerHTML = blockJS
              newScript.setAttribute('type', 'module');
              script.appendChild(newScript)
            }
          } else {
            const newScript = document.createElement('script')
            newScript.id = '_script'
            newScript.innerHTML = js
            newScript.setAttribute('type', 'module');
            script.parentNode.replaceChild(newScript, script)
          }
        }
        function setTW(config = { theme: {} }) {
          const twindConfig = document.getElementById('twind-config')
          const newTwindConfig = document.createElement('script')
          newTwindConfig.id = 'twind-config'
          newTwindConfig.innerHTML = JSON.stringify({ mode: 'silent', theme: config.theme })
          newTwindConfig.setAttribute('type', 'twind-config');
          twindConfig.parentNode.replaceChild(newTwindConfig, twindConfig)

          const twindScript = document.createElement('script')
          twindScript.setAttribute('type', 'module');
          twindScript.setAttribute('src', 'https://cdn.skypack.dev/twind/shim');
          twindScript.onload = () => {
            setTimeout(() => {
              this.postMessage('done')
            }, 200)
          }
          newTwindConfig.parentNode.appendChild(twindScript)
        }
      </script>
      <script type="twind-config" id="twind-config"></script>
    </head>
    <body class="primo-page">
    </body>
  </html>
`