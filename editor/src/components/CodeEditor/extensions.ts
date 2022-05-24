import { html } from "@codemirror/lang-html"
import { css } from "@codemirror/lang-css"
import { javascript } from "@codemirror/lang-javascript"

export function getLanguage(mode) {
  return {
    'html': html(),
    'css': css(),
    'javascript': javascript()
  }[mode]
}