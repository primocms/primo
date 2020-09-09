import ShortUniqueId from 'short-unique-id';

export const MODAL_TYPES = {
  image : 'Image (uploaded or from URL)',
  video : 'Video (embed from YouTube or Vimeo',
  embed : 'Custom Component',
  pageCode : 'Page code',
  sections : 'Page sections',
  settings : 'Page Data (logo/site name, page nav)',
  publish: 'Publish site with password',
  unlock: 'Unlock page for editing',
  pages: 'Pages under domain name',
  componentLibrary: 'Component Library',
  login: 'Logging in and signing up',
  user: 'User settings',
  domain: 'Connect custom domain name',
  pageList: 'Pages within domain',
  pageStyles: 'Page Styles'
}

export const tailwindConfig = `{
  theme: {
    container: {
      center: true
    }
  },
  variants: {}
}`


// TODO: Make these defaut site styles instead
export const pageStyles = `\
/* Default content styles */
.primo-content {
  @apply text-lg;
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
}`

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

export const createSite = () => ({
  id: getUniqueId(),
  label: '',
  pages: [ createPage('index', 'Home Page') ],
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