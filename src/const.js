import { createUniqueID } from './utilities'

export const tailwindConfig = `{
  theme: {
    container: {
      center: true,
      padding: '2rem'
    }
  },
  variants: {}
}`


export const defaultStyles = {
  raw: `
  
.primo-copy {
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
  .primo-copy h1 {
    font-size: 3rem;
  }

  .primo-copy h2 {
    font-size: 2.25rem;
  }
}
  `,
  final: `\
/* Default content styles */

.primo-copy {
  width: 100%;
  margin-right: auto;
  margin-left: auto;
  padding-right: 2rem;
  padding-left: 2rem
}

.primo-copy {
  font-size: 1.125rem;
  --text-opacity: 1;
  color: #374151;
  color: rgba(55, 65, 81, var(--text-opacity));
}

.primo-copy h1 {
    font-size: 1.875rem;
    font-weight: 500;
  }

.primo-copy h2 {
    font-size: 1.5rem;
    font-weight: 500;
  }

.primo-copy ol {
    list-style-type: decimal;
  }

.primo-copy ul {
    list-style-type: disc;
    list-style-position: inside;
  }

.primo-copy ul p {
      display: inline;
    }

.primo-copy ol {
    list-style-type: decimal;
    list-style-position: inside;
  }

.primo-copy a {
    --text-opacity: 1;
    color: #1c64f2;
    color: rgba(28, 100, 242, var(--text-opacity));
    text-decoration: underline;
  }

.primo-copy blockquote {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    padding: 1.5rem;
  }

.primo-copy mark {
    --text-opacity: 1;
    color: #161e2e;
    color: rgba(22, 30, 46, var(--text-opacity));
    --bg-opacity: 1;
    background-color: #fce96a;
    background-color: rgba(252, 233, 106, var(--bg-opacity));
  }

@media (min-width: 1024px) {
  .primo-copy h1 {
    font-size: 3rem;
  }

  .primo-copy h2 {
    font-size: 2.25rem;
  }
}
  `,
  tailwind: `{
  theme: {
    container: {
      center: true,
      padding: '2rem'
    }
  },
  variants: {}
}`
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
    styles: {
      raw: '',
      final: '',
      tailwind: ''
    },
    wrapper: {
      head: {
        raw: '',
        final: ''
      },
      below: {
        raw: '',
        final: ''
      }
    },
    fields: []
  },
  wrapper: {
    head: {
      raw: '',
      final: ''
    },
    below: {
      raw: '',
      final: ''
    }
  },
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
  styles: {
    raw: '',
    final: '',
    tailwind: defaultStyles.tailwind
  },
  wrapper: DEFAULTS.wrapper,
  fields: []
})

export const createSite = (name) => ({
  name,
  pages: [createPage('index', 'Home Page')],
  styles: DEFAULTS.styles,
  wrapper: DEFAULTS.wrapper,
  fields: [],
  symbols: []
})


export const createNewSite = ({ id = '00000', name = 'website' }) => ({
  name,
  pages: [createPage('index', 'Home Page')],
  styles: DEFAULTS.styles,
  wrapper: DEFAULTS.wrapper,
  fields: [],
  symbols: []
})