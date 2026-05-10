import { VERSION as SVELTE_VERSION } from 'svelte/compiler'
import { PRIMO_BASELINE_CSS } from '$lib/common/baseline-css'

const preview_iframe_head = (head = '') => `
  <style data-primo-baseline>${PRIMO_BASELINE_CSS}</style>
  ${head}
`

const editor_context_tag =
	"<script>window.__PRIMO_CONTEXT__ = { environment: 'editor' };</script>"

export const dynamic_iframe_srcdoc = (head, broadcast_id) => {
	return `
  <!DOCTYPE html>
  <html>
    <head>
      ${editor_context_tag}
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${preview_iframe_head(head)}
      <script type="module">
        let mod;
        let reset;
        let last_rendered_html = '';

        const channel = new BroadcastChannel('${broadcast_id}');
        channel.onmessage = async ({data}) => {
          const { event, payload = {} } = data
          if (payload.componentApp) {
            await init(payload.componentApp)
          }
          if (payload.data) {
            update(payload.data)
          }
        }
        channel.postMessage({ event: 'INITIALIZED' });

        async function init(source) {
          const blob = new Blob([source], { type: 'text/javascript' })
          const url = URL.createObjectURL(blob)
          await import(url)
            .then((module) => {
              mod = module
            })
            .finally(() => {
              try { URL.revokeObjectURL(url) } catch (_) {}
            });
        }

        function update(props) {
          // Reset runtime error display in parent
          try { channel.postMessage({ event: 'BEGIN' }); } catch (_) {}

          // Reset log tracking for this render
          logsThisRender = false;

          const previous_html = document.body.innerHTML;
          document.body.innerHTML = '';

          if (reset) {
            try { reset() } catch (_) {}
            reset = null;
          }

          if (!mod) return

          try {
            const component = mod.mount(mod.default, {
              target: document.body,
              props
            })
            const { unmount } = mod
            reset = () => unmount(component)
            last_rendered_html = document.body.innerHTML;
            channel.postMessage({ event: 'MOUNTED' })
            // After enough time for console logs to be called and sent, check if any were produced
            // Wait longer than the throttle delay (120ms) to ensure any mount-time logs are sent first
            setTimeout(() => {
              if (!logsThisRender) {
                try { channel.postMessage({ event: 'SET_CONSOLE_LOGS', payload: { logs: null } }); } catch (_) {}
              }
            }, 300)
          } catch(e) {
            reset = null;
            if (last_rendered_html) {
              document.body.innerHTML = last_rendered_html;
            } else {
              document.body.innerHTML = previous_html;
            }
            channel.postMessage({
              event: 'SET_ERROR',
              payload: {
                error: e.toString()
              }
            });
          }
        }

        // Install a safe console proxy that forwards logs to the parent
        let logsThisRender = false;
        (function setupConsoleBridge(){
          try {
            const methods = ['log','info','warn','error'];
            const original = Object.create(null);
            for (const m of methods) {
              const fn = (console && typeof console[m] === 'function') ? console[m].bind(console) : null;
              original[m] = fn;
            }

            const safeSerialize = (v) => {
              try { return JSON.parse(JSON.stringify(v)); } catch (_) { return typeof v === 'string' ? v : String(v); }
            };

            let timer = null;
            let lastQueued = undefined;
            let lastSent = undefined;
            const sendThrottled = (value) => {
              lastQueued = value;
              logsThisRender = true;
              if (timer) return;
              timer = setTimeout(() => {
                timer = null;
                const payload = lastQueued;
                const key = (()=>{ try { return JSON.stringify(payload);} catch(_) { return String(payload);} })();
                if (key !== lastSent) {
                  try { channel.postMessage({ event: 'SET_CONSOLE_LOGS', payload: { logs: payload } }); } catch(_) {}
                  lastSent = key;
                }
              }, 120);
            };

            for (const m of methods) {
              console[m] = (...args) => {
                try {
                  const payload = args.length <= 1 ? safeSerialize(args[0]) : args.map(safeSerialize);
                  sendThrottled(payload);
                } catch(_) {}
                if (original[m]) try { original[m](...args); } catch(_) {}
              };
            }
          } catch(_) {
            // ignore logging bridge failures
          }
        })();
		  </script>
    </head>
    <body></body>
  </html>
`
}

export const static_iframe_srcdoc = ({ head = '', html, css, foot = '' }) => {
	return `
    <!DOCTYPE html>
    <html>
      <head>
        ${editor_context_tag}
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${preview_iframe_head(head)}
      </head>
      <body id="page">
        ${html}
        <style>${css}</style>
        ${foot}
      </body>
    </html>
  `
}

export const component_iframe_srcdoc = ({ head = '', foot = '', zone = 'body', section_id = '', symbol_id = '' }) => {
	// Determine semantic wrapper based on zone
	const wrapper_tag = zone === 'header' ? 'header' : zone === 'footer' ? 'footer' : 'main'
	const wrapper_start = `<${wrapper_tag}>`
	const wrapper_end = `</${wrapper_tag}>`

	return `
    <!DOCTYPE html>
    <html>
      <head>
        ${editor_context_tag}
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script type="module">
          let mod;
          let reset;

          window.addEventListener('message', async ({ data }) => {
            const payload = data && data.payload
            if (!payload) return
            if (payload.js) {
              await init(payload.js)
            }
            if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
              update(payload.data)
            }
          })

          async function init(source) {
            if (!source) return
            const blob = new Blob([source], { type: 'text/javascript' })
            const url = URL.createObjectURL(blob)
            await import(url)
              .then((module) => {
                mod = module
              })
              .catch((e) => {
                target.innerHTML = ''
                console.error(e)
                const message = typeof e === 'string' ? e : e?.stack || e?.message || e?.toString?.() || 'Unknown error'
                window.parent.postMessage({ type: 'component-error', error: String(message).split('\\n')[0] }, '*')
                throw e
              })
              .finally(() => {
                try { URL.revokeObjectURL(url) } catch (_) {}
              })
          }

          function update(props) {
            const target = document.querySelector('#component')
            if (!target) return
            if (!mod) return
            if (reset) reset()
            try {
              const component = mod.mount(mod.default, {
                target,
                props
              })
              const { unmount } = mod
              reset = () => unmount(component)
              window.parent.postMessage({ type: 'component-error', error: '' }, '*')
            } catch (e) {
              target.innerHTML = ''
              console.error(e)
              const message = typeof e === 'string' ? e : e?.stack || e?.message || e?.toString?.() || 'Unknown error'
              window.parent.postMessage({ type: 'component-error', error: String(message).split('\\n')[0] }, '*')
            }
          }
        </script>
        ${preview_iframe_head(head)}
      </head>
      <body style="overflow:hidden;">
        ${wrapper_start}
        <div data-section="${section_id}" id="section-${section_id}" data-symbol="${symbol_id}">
          <div id="component"></div>
        </div>
        ${wrapper_end}
        ${foot}
        <style>
          [contenteditable="true"] { outline: 0 !important; }
        </style>
      </body>
    </html>
  `
}
