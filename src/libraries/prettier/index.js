import prettier from 'prettier'
import html from 'prettier/esm/parser-html'
import css from 'prettier/esm/parser-postcss'
import babel from 'prettier/esm/parser-babel'

const plugins = {
  html, css, babel
}

export default async function format(code, { mode, position }) {
  let formatted
  try {
    if (mode === 'javascript') {
      mode = 'babel'
    }
  
    formatted = prettier.formatWithCursor(code, { 
      parser: mode,  
      jsxBracketSameLine: true,
      cursorOffset: position,
      plugins: [
        plugins[mode]
      ]
    })
  } catch(e) {
    console.warn(e)
  }

  return formatted
}
