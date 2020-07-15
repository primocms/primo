import App from './App.svelte'
import ComponentPreview from './Preview.svelte'
import MultiPreview from './MultiPreview.svelte'
import SinglePreview from './SinglePreview.svelte'
import { getUniqueId } from 'utils'

const { hostname:domain } = window.location
const subdomain = domain.split('.')[0]

const params = new URL(location.href).searchParams;
const preview = params.get('preview'); 
const action = params.get('a')
let app;

const pageData = {
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
                html: '<p>some simple content</p>'
              }
            }
          ]
        }
      ]
    }
  ],
  dependencies: {
    headEmbed : '',
    libraries: [],
    // customScripts: [],
  },
  settings: {
    globalStyles: {
      uncompiled: '',
      compiled: '',
      tailwindConfig: '{  theme: {    container: {      center: true    }  },  variants: {}}'
    },
    javascript: '',
    identity : {
      title: '', 
      url: '',
      description: ''
    }
  }
}

const siteData = {
  pages: {
    index: {
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
                    html: '<p>some simple content</p>'
                  }
                }
              ]
            }
          ]
        }
      ],
      dependencies: {
        headEmbed : '',
        libraries: [],
        // customScripts: [],
      },
      settings: {
        globalStyles: {
          uncompiled: '',
          compiled: '',
          tailwindConfig: '{  theme: {    container: {      center: true    }  },  variants: {}}'
        },
        javascript: '',
        identity : {
          title: '', 
          url: '',
          description: ''
        }
      }
    }
  },
  users: {
    'a@primo.press' : {
      admin: true,
      role: 'developer'
    }
  },
  components: {
    'ng1p7' : {
      height: '',
      id: '',
      title: '',
      type: '',
      value: {
        raw: {
          html: '<h1>Something</h1>',
          css: '',
          js: '',
          fields: []
        },
        final: {
          html: '<h1>Something</h1>',
          css: '',
          js: '',
        }
      }
    }
  }
}

const symbolData = {
  'ng1p7' : {
    height: '',
    id: '',
    title: '',
    type: '',
    value: {
      raw: {
        html: '<h1>Something</h1>',
        css: '',
        js: '',
        fields: []
      },
      final: {
        html: '<h1>Something</h1>',
        css: '',
        js: '',
      }
    }
  }
}

if (!preview) {
  app = new App({
    target: document.body,
    props: {
      subdomain,
      pageData,
      siteData,
      symbolData,
    }
  });
} else if (preview === 'single') {
  const previewId = params.get('page'); 
  app = new SinglePreview({ 
    target: document.body,
    props: {previewId}
  });
} else if (preview === 'multiple') {
  app = new MultiPreview({ target: document.body });
} else if (preview) {
  app = new ComponentPreview({ target: document.body });
}

export default app;