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
            // TODO: re-render component when passing only a subset of existing props (i.e. when a prop has been deleted)
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


        let set = false
        function setListeners() {
          if (set) return
          document.body.querySelectorAll('*').forEach(el => {
            el.addEventListener('mouseenter', () => {
              console.log(el.__svelte_meta)
              const path = getDomPath(el)
              window.postMessage({ event: 'path', payload: path })
            })
          })
        }

        window.addEventListener('message', ({data}) => {
          if (data.event === 'highlight') {
            // const el = document.querySelector(data.payload)
            // console.log({el})
            // el.style.background = 'red'
          }
          if (data.componentApp || data.componentData) {
            update(data.componentApp, data.componentData)
            setTimeout(setListeners, 200)
          }
        }, false)

        function getDomPath(el) {
          if (!el) {
            return;
          }
          var stack = [];
          var isShadow = false;
          while (el.parentNode != null) {
            // console.log(el.nodeName);
            var sibCount = 0;
            var sibIndex = 0;
            // get sibling indexes
            for ( var i = 0; i < el.parentNode.childNodes.length; i++ ) {
              var sib = el.parentNode.childNodes[i];
              if ( sib.nodeName == el.nodeName ) {
                if ( sib === el ) {
                  sibIndex = sibCount;
                }
                sibCount++;
              }
            }
            // if ( el.hasAttribute('id') && el.id != '' ) { no id shortcuts, ids are not unique in shadowDom
            //   stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
            // } else
            var nodeName = el.nodeName.toLowerCase();
            if (isShadow) {
              nodeName += "::shadow";
              isShadow = false;
            }
            if ( sibCount > 1 ) {
              stack.unshift(nodeName + ':nth-of-type(' + (sibIndex + 1) + ')');
            } else {
              stack.unshift(nodeName);
            }
            el = el.parentNode;
            if (el.nodeType === 11) { // for shadow dom, we
              isShadow = true;
              el = el.host;
            }
          }
          stack.splice(0,1); // removes the html element
          return stack.join(' > ');
        }
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