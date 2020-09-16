import ShortUniqueId from 'short-unique-id';

export const tailwindConfig = `{
  theme: {
    container: {
      center: true
    }
  },
  variants: {}
}`


export const defaultStyles = {
  raw: `\
/* Default content styles */\n
.primo-content {
  @apply text-lg text-gray-700;
  h1 {
    @apply text-3xl font-medium;
  }
  h2 {
    @apply text-2xl font-medium;
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
  type: 'component',
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
})

export const createSite = (id = getUniqueId()) => ({
  id,
  label: '',
  pages: [ createPage('index', 'Home Page') ],
  dependencies: {
    headEmbed: '',
    libraries: []
  },
  styles: defaultStyles,
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
  fields: [],
  symbols: []
})

export const DEFAULTS = {
  site: createSite(),
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
  }
}