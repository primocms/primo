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
      center: true,
      padding: '2rem'
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
                "html":"<p><br></p><h3><strong>This is a primo site</strong></h3><p>primo sites are made of pages. Pages are made of copy and components. This paragraph and the title above it are copy. You can edit copy visually, right on the page, and primo will convert it into clean HTML when it builds your site. You can format it by using the toolbar or by using Markdown (try typing # before a line to get a heading). You can style the copy on this page and your site by clicking the CSS button in the toolbar. </p><p><br></p><p>To start from a blank slate, delete everything in this section, then double-backspace to delete the section itself. Then click ‘Section’ in the toolbar to add a page section to your page. </p><p><br></p>"
              }
            },
            {
              "type":"component",
              "id": getUniqueId(),
              "symbolID":null,
              "value":{
                "raw":{
                    "html":"<aside class=\"bg-indigo-600 shadow-xl rounded flex flex-col items-start justify-start p-12 text-white\">\n     <h3 class=\"text-2xl font-bold mb-5 leading-none\">{{title}}</h3>\n    <div class=\"body\">{{{body}}}</div>  \n    {{#if links}}\n        <div class=\"mt-8\">\n        \t{{#each links}}\n                <a target=\"blank\" href=\"{{url}}\" class=\"px-6 py-4 mr-2 bg-indigo-700 hover:bg-indigo-800 transition-colors duration-200\">\n                \t<span class=\"font-semibold\">{{title}}</span>\n                    <svg class=\"w-6 inline-block -mr-3\" fill=\"currentColor\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path fill-rule=\"evenodd\" d=\"M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z\" clip-rule=\"evenodd\"></path></svg>\n                </a>\n            {{/each}}\n        </div>\n    {{/if}}\n</aside>\n",
                    "css":".body {\n\ta {\n\t\t@apply underline;\n    }\n    p {\n    \t@apply pb-2;\n    }\n}",
                    "js":"",
                    "fields":[
                      {
                          "id":"aqwk8",
                          "key":"title",
                          "label":"Title",
                          "value":"Welcome to primo. ",
                          "type":"text",
                          "fields":[
                            
                          ]
                      },
                      {
                          "id":"21iuh",
                          "key":"body",
                          "label":"Body",
                          "value":"<p>This here is a single-use component, we made it for you. We used <a href=\"https://tailwindcss.com/\">TailwindCSS</a>, so unlike other prebuilt components, it's actually easy to edit. Components in primo are completely self-contained - so not only do you edit their structure (html), styles (css), and interactivity (js) in the same place, but also their templating logic (handlebars) and their user fields (cms). That way you can build and edit your site one self-contained component at a time.</p>\n<p>You can reuse a component across your site by converting it into a Symbol - that will save it in your Symbol Library and enable you and any content editors to create instances of the Symbol anywhere on your site. You can also copy and paste it into your other websites. You can find free starter Symbols at the <a href=\"https://primo.af/library.html\">primo public library</a>.</p>\n<p>Happy Building.</p>",
                          "type":"content",
                          "fields":[
                            
                          ]
                      },
                      {
                          "id":"cpuvh",
                          "key":"links",
                          "label":"Links",
                          "value":[
                            {
                                "title":"Documentation",
                                "url":"http://docs.primo.af/"
                            },
                            {
                                "title":"Components",
                                "url":"https://primo.af/library.html"
                            }
                          ],
                          "type":"repeater",
                          "fields":[
                            {
                                "id":"dhluu",
                                "key":"title",
                                "label":"Title",
                                "value":"",
                                "type":"text"
                            },
                            {
                                "id":"e9tl2",
                                "key":"url",
                                "label":"URL",
                                "value":"",
                                "type":"url"
                            }
                          ]
                      }
                    ]
                },
                "final":{
                    "html":"<aside class=\"bg-indigo-600 shadow-xl rounded flex flex-col items-start justify-start p-12 text-white\">\n     <h3 class=\"text-2xl font-bold mb-5 leading-none\">Welcome to primo. </h3>\n    <div class=\"body\"><p>This here is a single-use component, we made it for you. We used <a href=\"https://tailwindcss.com/\">TailwindCSS</a>, so unlike other prebuilt components, it's actually easy to edit. Components in primo are completely self-contained - so not only do you edit their structure (html), styles (css), and interactivity (js) in the same place, but also their templating logic (handlebars) and their user fields (cms). That way you can build and edit your site one self-contained component at a time.</p>\n<p>You can reuse a component across your site by converting it into a Symbol - that will save it in your Symbol Library and enable you and any content editors to create instances of the Symbol anywhere on your site. You can also copy and paste it into your other websites. You can find free starter Symbols at the <a href=\"https://primo.af/library.html\">primo public library</a>.</p>\n<p>Happy Building.</p></div>  \n        <div class=\"mt-8\">\n                <a target=\"blank\" href=\"http://docs.primo.af/\" class=\"px-6 py-4 mr-2 bg-indigo-700 hover:bg-indigo-800 transition-colors duration-200\">\n                \t<span class=\"font-semibold\">Documentation</span>\n                    <svg class=\"w-6 inline-block -mr-3\" fill=\"currentColor\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path fill-rule=\"evenodd\" d=\"M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z\" clip-rule=\"evenodd\"></path></svg>\n                </a>\n                <a target=\"blank\" href=\"https://primo.af/library.html\" class=\"px-6 py-4 mr-2 bg-indigo-700 hover:bg-indigo-800 transition-colors duration-200\">\n                \t<span class=\"font-semibold\">Components</span>\n                    <svg class=\"w-6 inline-block -mr-3\" fill=\"currentColor\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"><path fill-rule=\"evenodd\" d=\"M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z\" clip-rule=\"evenodd\"></path></svg>\n                </a>\n        </div>\n</aside>\n",
                    "css":"#component-60hiu .body a {\n      text-decoration: underline;\n    }\n    #component-60hiu .body p {\n      padding-bottom: 0.5rem;\n    }",
                    "js":""
                }
              }
            },
          ]
        }
      ]
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

export const createSite = (id = getUniqueId(), label = '') => ({
  id,
  label,
  pages: [ createPage('index', 'Home Page') ],
  styles: DEFAULTS.styles,
  wrapper: DEFAULTS.wrapper,
  fields: [],
  symbols: []
})
