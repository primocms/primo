const plugins = {
  html, css, babel
}

let prettier
let html
let css
let babel 

export default async function format(code, { mode, position }) {
  if (!pretter) {
    prettier = await import('prettier').default
    html = await import('prettier/esm/parser-html').default;
    css = await import('prettier/esm/parser-postcss').default
    babel = await import('prettier/esm/parser-babel').default
  }

  let formatted
  try {
    if (mode === 'javascript') {
      mode = 'babel'
    }
  
    formatted = prettier.formatWithCursor(code, { 
      parser: mode,  
      bracketSameLine: true,
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
