import ShortUniqueId from 'short-unique-id';

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
  raw: `\
/* Default content styles */\n
.primo-copy {
  @apply text-lg text-gray-700;
  h1 {
    @apply text-3xl font-medium;
  }
  h2 {
    @apply text-2xl font-medium;
  }
  ol {
    @apply list-decimal;
  }
  ul {
    @apply list-disc list-inside;
    p {
        @apply inline;
    }
  } 
  ol {
    @apply list-decimal list-inside;
  } 
  a {
    @apply text-blue-600 underline;
  }
  blockquote {
      @apply shadow-md p-6;
  }
  mark {
    @apply text-gray-900 bg-yellow-200;
  }
  
  @screen lg {
    h1 {
      @apply text-5xl;
    }
    h2 {
      @apply text-4xl;
    }
  }
}`,
  final: `\
/* Default content styles */

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
      center: true
    }
  },
  variants: {}
}`
}

export const createComponent = () => ({
  type: 'component',
  id: getUniqueId(),
  symbolID: null,
  value: {
    raw: {
      html: '',
      css: '',
      js: '',
      fields: []
    },
    final: {
      html: '',
      css: '',
      js: ''
    }
  }
})

export const createSymbol = () => ({
  type: 'symbol',
  id: getUniqueId(),
  value: {
    raw: {
      css: '',
      html: '',
      js: '',
      fields: []
    },
    final: {
      css: '',
      html: '',
      js: '',
    }
  }
})

function getUniqueId() {
  return new ShortUniqueId().randomUUID(5).toLowerCase();
}

export const DEFAULTS = {
  // site: createSite(),
  content: [
    {
      id: '00000',
      width: 'contained',
      columns: [
        {
          id: '00000',
          size: 'w-full',
          rows: [
            {
              id: '00000',
              type: 'content',
              value: {
                html: '<p><br></p>'
              }
            }
          ]
        }
      ]
    }
  ],
  page: {
    id: '',
    title: '',
    content: [
      {
        id: getUniqueId(),
        width: 'contained',
        columns: [
          {
            id: getUniqueId(),
            size: 'w-full',
            rows: [
              {
                id: getUniqueId(),
                type: 'content',
                value: {
                  html: '<p><br></p>'
                }
              }
            ]
          }
        ]
      }
    ],
    dependencies: {
      headEmbed: '',
      libraries: []
    },
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
  dependencies: {
    headEmbed: '',
    libraries: []
  },
  fields: [],
  symbols: []
}

export const createPage = (id = getUniqueId(), title) => ({
  id,
  title,
  content: [
    {
      id: getUniqueId(),
      width: 'contained',
      columns: [
        {
          id: getUniqueId(),
          size: 'w-full',
          rows: [
            {
              id: getUniqueId(),
              type: 'content',
              value: {
                html: '<p><br></p>'
              }
            }
          ]
        }
      ]
    }
  ],
  dependencies: DEFAULTS.dependencies,
  styles: {
    raw: '',
    final: '',
    tailwind: defaultStyles.tailwind
  },
  wrapper: DEFAULTS.wrapper,
  fields: [],
  symbols: []
})

export const createSite = (id = getUniqueId(), label = '') => ({
  id,
  label,
  pages: [ createPage('index', 'Home Page') ],
  dependencies: DEFAULTS.dependencies,
  styles: DEFAULTS.styles,
  wrapper: DEFAULTS.wrapper,
  fields: [],
  symbols: []
})
