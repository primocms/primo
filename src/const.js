// import { createUniqueID } from './utilities'
import {customAlphabet} from 'nanoid/non-secure'

function createUniqueID(length = 5) {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz', length);
  return nanoid()
}


export const defaultStyles = {
  raw: `
  
.primo-content {
  margin: 0 auto;
  width: 100%;
  padding-right: 2rem;
  padding-left: 2rem;
  font-size: 1.125rem;
  color: #374151;
  
  h1 { 
    font-size: 1.875rem;
    font-weight: 500;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 500;
  }

  ol {
    list-style-type: decimal;
    list-style-position: inside;
  }

  ul {
    list-style-type: disc;
    list-style-position: inside;
  }

  p {
    display: inline;
  }

  ol {
    list-style-type: decimal;
    list-style-position: inside;
  }

  a {
    color: #1c64f2;
    text-decoration: underline;
  }

  blockquote {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 1.5rem;
  }

  mark {
    --text-opacity: 1;
    color: #161e2e;
    --bg-opacity: 1;
    background-color: #fce96a;
  }
}

@media (min-width: 1024px) {
  .primo-content h1 {
    font-size: 3rem;
  }

  .primo-content h2 {
    font-size: 2.25rem;
  }
}
  `,
  final: `\
/* Default content styles */

.primo-content {
  width: 100%;
  margin-right: auto;
  margin-left: auto;
  padding-right: 2rem;
  padding-left: 2rem
}

.primo-content {
  font-size: 1.125rem;
  --text-opacity: 1;
  color: #374151;
  color: rgba(55, 65, 81, var(--text-opacity));
}

.primo-content h1 {
    font-size: 1.875rem;
    font-weight: 500;
  }

.primo-content h2 {
    font-size: 1.5rem;
    font-weight: 500;
  }

.primo-content ol {
    list-style-type: decimal;
  }

.primo-content ul {
    list-style-type: disc;
    list-style-position: inside;
  }

.primo-content ul p {
      display: inline;
    }

.primo-content ol {
    list-style-type: decimal;
    list-style-position: inside;
  }

.primo-content a {
    --text-opacity: 1;
    color: #1c64f2;
    color: rgba(28, 100, 242, var(--text-opacity));
    text-decoration: underline;
  }

.primo-content blockquote {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 1.5rem;
  }

.primo-content mark {
    --text-opacity: 1;
    color: #161e2e;
    color: rgba(22, 30, 46, var(--text-opacity));
    --bg-opacity: 1;
    background-color: #fce96a;
    background-color: rgba(252, 233, 106, var(--bg-opacity));
  }

@media (min-width: 1024px) {
  .primo-content h1 {
    font-size: 3rem;
  }

  .primo-content h2 {
    font-size: 2.25rem;
  }
}
  `,
}

export const createComponent = () => ({
  type: 'component',
  id: createUniqueID(),
  symbolID: null,
  value: {
    html: '',
    css: '',
    js: '',
    fields: []
  }
})

export const createSymbol = () => ({
  type: 'symbol',
  id: createUniqueID(),
  value: {
    css: '',
    html: '',
    js: '',
    fields: []
  }
})

export const DEFAULTS = {
  content: [
    {
      id: createUniqueID(),
      type: 'options',
    }
  ],
  page: {
    id: '',
    title: '',
    content: [
      {
        id: createUniqueID(),
        type: 'options',
      }
    ],
    html: {
      head: '',
      below: ''
    },
    css: '',
    fields: []
  },
  html: {
    head: '',
    below: ''
  },
  css: '',
  styles: defaultStyles,
  fields: [],
  symbols: []
}

export const createPage = (id = createUniqueID(), title) => ({
  id,
  title,
  content: [
    {
      id: createUniqueID(),
      type: 'options',
    }
  ],
  css: '',
  html: {
    head: '',
    below: ''
  },
  fields: []
})

export const createSite = ({ id, name} = { id: 'default', name: 'Default' }) => ({
  id,
  name,
  pages: [createPage('index', 'Home Page')],
  css: `\
  @import url("https://unpkg.com/tailwindcss@2.2.17/dist/base.css");

  html {
  
    /* Colors */
    --color-accent: #154BF4;
    --color-dark: #3E3D43;
    --color-light: #FCFCFD;
    --color-shade: #CBCACE;
    --color-white: #FFF;
  
    /* Default property values */
    --background: var(--color-white);
    --color: var(--color-dark);
    --padding: 2rem;
    --border: 1px solid var(--color-shade);
    --box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.04);
    --border-radius: 8px;
    --max-width: 1200px;
    --border-color: var(--color-shade);
    --transition-time: 0.1s;
    --transition: var(--transition-time) color,
      var(--transition-time) background-color,
        var(--transition-time) border-color,
          var(--transition-time) text-decoration-color,
            var(--transition-time) box-shadow, var(--transtion-time) transform;
  
    /* Elements */
    --heading-color: #252428;
    --heading-font-size: 39px;
    --heading-line-height: 48px;
    --heading-font-weight: 800;
  
    --subheading-color: #3E3D43;
  
    --button-color: white;
    --button-background: var(--color-accent);
    --button-border-radius: 4px;
    --button-padding: 8px 20px;
  
  }
  
  .primo-page {
    font-family: system-ui, sans-serif;
    color: var(--color);
    font-size: 1rem;
    background: var(--background);
  }
  
  .primo-section.content {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: var(--padding);
  
    & > * {
      max-width: 700px;
    }
  
    img {
      width: 100%;
      margin-bottom: 1rem;
    }
  
    p {
      padding: 0.25rem 0;
      line-height: 1.5;
    }
  
    h1 {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }
  
    h2 {
      font-size: 2.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
  
    h3 {
      font-size: 1.75rem; 
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
  
    ul {
      list-style: disc;
      padding: 0.5rem 0;
      padding-left: 1.25rem;
    }
  
    ol {
      list-style: decimal;
      padding: 0.5rem 0;
      padding-left: 1.25rem;
    }
  }
  
  .page-container {
    max-width: var(--max-width, 1200px);
    margin: 0 auto;
    padding: 6rem 2rem;
  }
  
  .body {
    font-size: var(--body-font-size);
  }
  
  .heading {
    font-size: var(--heading-font-size, 49px);
    line-height: var(--heading-line-height, 1);
    font-weight: var(--heading-font-weight, 700);
    color: var(--heading-color, #252428);
  }
  
  .button {
    color: var(--color-white, white);
    background: var(--color-accent, #154BF4);
    border: 2px solid transparent;
    border-radius: 5px;
    padding: 8px 20px;
    transition: var(--transition);
  
    &:hover {
      box-shadow: 0 0 10px 5px rgba(0, 0, 0, 0.1);
    }
  
    &.is-inverted {
      background: var(--color-white);
      color: var(--color-accent);
      border-color: var(--color-accent);
    }
  }
  
}
`,
  html: {
    head: '',
    below: ''
  },
  fields: [],
  symbols: []
})


export const createNewSite = ({ id = '00000', name = 'website' }) => ({
  name,
  pages: [createPage('index', 'Home Page')],
  css: '',
  html: {
    head: '',
    below: ''
  },
  fields: [],
  symbols: []
})