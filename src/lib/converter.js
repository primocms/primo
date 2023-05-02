import _ from 'lodash-es'
import { v4 as uuidv4 } from 'uuid';
import { createUniqueID } from "$lib/editor/utilities";
import { getPlaceholderValue, getEmptyValue } from '$lib/editor/utils'
import showdown from '$lib/editor/libraries/showdown/showdown.min.js'
import showdownHighlight from 'showdown-highlight'
export const converter = new showdown.Converter({
  extensions: [showdownHighlight()],
})

const Field = (field) => {
  if (field.type === 'content') {
    field.type = 'markdown'
  }
  delete field.default
  return {
    ...field,
    fields: field.fields.map(Field)
  }
}

export function validate_site_structure_v2(site) {

  const new_site_id = uuidv4()

  // current site version -> replace IDs & return
  if (site.version === 2) {
    const new_page_ids = new Map()
    const new_symbol_ids = new Map()

    const parent_pages = site.pages.filter(p => p.parent === null).map(page => {
      const new_id = uuidv4()
      new_page_ids.set(page.id, new_id)
      return ({
        ...page,
        id: new_id,
        site: new_site_id,
        preview: `${new_site_id}/${new_id}/index.html`
      })
    })
    const child_pages = site.pages.filter(p => p.parent !== null)

    return {
      ...site,
      site: {
        ...site.site,
        id: new_site_id
      },
      pages: [
        ...parent_pages,
        ...child_pages.map(page => {
          const new_id = uuidv4()
          new_page_ids.set(page.id, new_id)
          return ({
            ...page,
            id: new_id,
            site: new_site_id,
            preview: `${new_site_id}/${new_id}/index.html`,
            parent: new_page_ids.get(page.parent)
          })
        })
      ],
      symbols: site.symbols.map(s => {
        const new_id = uuidv4()
        new_symbol_ids.set(s.id, new_id)
        return ({
          ...s,
          id: new_id,
          site: new_site_id
        })
      }),
      sections: site.sections.map(s => ({
        ...s,
        id: uuidv4(),
        symbol: new_symbol_ids.get(s.symbol),
        page: new_page_ids.get(s.page)
      })),
    }
  }

  site = validateSiteStructure(site)


  const Symbol = (symbol) => {
    const content = Object.entries(site.content).reduce((accumulator, [locale, value]) => {
      accumulator[locale] = {}
      symbol.fields.forEach(field => {
        accumulator[locale][field.key] = getPlaceholderValue(field)
      })
      return accumulator
    }, {})

    return {
      id: uuidv4(),
      site: new_site_id,
      name: symbol.name,
      code: symbol.code,
      fields: symbol.fields.map(Field),
      _old_id: symbol.id,
      content
    }
  }

  const symbols = [...site.symbols.map(symbol => Symbol(symbol)), {
    id: uuidv4(),
    site: new_site_id,
    name: 'Content',
    code: {
      html: `<div class="section"><div class="section-container content">{@html content.html}</div></div>`,
      css: `
.content {

  :global(img) {
    width: 100%;
    margin: 2rem 0;
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius);
  }

  :global(p) {
    padding: 0.25rem 0;
    line-height: 1.5;
  }

  :global(a) {
    text-decoration: underline;
  }

  :global(h1) {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  :global(h2) {
    font-size: 2.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  :global(h3) {
    font-size: 1.75rem; 
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  :global(ul) {
    list-style: disc;
    padding: 0.5rem 0;
    padding-left: 1.25rem;
  }

  :global(ol) {
    list-style: decimal;
    padding: 0.5rem 0;
    padding-left: 1.25rem;
  }

  :global(blockquote) {
    padding: 2rem;
    box-shadow: var(--box-shadow);
    border-radius: var(--border-radius);
  }
}
      `,
      js: ''
    },
    fields: [{
      id: createUniqueID(),
      key: 'content',
      label: 'Content',
      type: 'markdown',
      fields: [],
      options: {},
      is_static: false,
    }],
    content: {
      en: {
        'content': {
          markdown: '# This is a content block',
          html: '<h1>This is a content block</h1>'
        }
      }
    },
    _old_id: null
  }]

  const Page = (page) => {

    const content = Object.entries(site.content).reduce((accumulator, [locale, value]) => {
      accumulator[locale] = {}
      page.fields.forEach(field => {
        accumulator[locale][field.key] = value?.[page.id]?.[field.key] || getEmptyValue(field)
      })
      return accumulator
    }, {})

    return {
      id: uuidv4(),
      name: page.name,
      url: page.id,
      code: page.code,
      fields: page.fields.map(Field) || [],
      sections: page.sections, // for later use, to be removed
      pages: page.pages || [], // for later use, to be removed
      content,
      site: new_site_id
    }
  }

  const Section = (section, page) => {

    let symbol
    let content

    if (section.type === 'component') {
      symbol = symbols.find(s => s._old_id === section.symbolID)
      content = Object.entries(site.content).reduce((accumulator, [locale, value]) => {
        accumulator[locale] = value?.[page.url]?.[section.id]
        return accumulator
      }, {})
    } else if (section.type === 'content') {
      symbol = symbols.at(-1)
      content = Object.entries(site.content).reduce((accumulator, [locale, value]) => {
        const html = value?.[page.url]?.[section.id]
        accumulator[locale] = {
          content: {
            html,
            markdown: typeof (html) === 'string' && html ? converter.makeMarkdown(html) : ''
          }
        }
        return accumulator
      }, {})
    }

    return ({
      id: uuidv4(),
      page: page.id,
      symbol: symbol.id,
      content,
      index: page.sections.findIndex((s) => s.id === section.id)
    })
  }

  const pages = _.flatten(site.pages.map(page => [Page(page), ...page.pages.map(child => Page(child))]))

  // children need to be derived after page IDs have been assigned
  const pages_with_children = pages.map(page => {
    const parent = pages.find(p => p.pages.find(c => c.id === page.url))
    return {
      ...page,
      parent: parent?.id || null
    }
  })

  const sections = _.flatten(pages.map(page => page.sections.map(s => Section(s, page))))

  const content = Object.entries(site.content).reduce((accumulator, [locale, value]) => {
    accumulator[locale] = {}
    site.fields.forEach(field => {
      accumulator[locale][field.key] = value?.[field.key] || getEmptyValue(field)
    })
    return accumulator
  }, {})

  return {
    site: {
      id: new_site_id,
      url: site.id,
      name: site.name,
      code: site.code,
      fields: site.fields,
      content
    },
    pages: pages_with_children.map(page => {
      delete page.sections
      delete page.pages
      return page
    }),
    sections,
    symbols: symbols.map(symbol => {
      delete symbol._old_id
      return symbol
    })
  }

}

export function validate_symbol(symbol) {
  if (!symbol.content || _.isEmpty(symbol.content)) {
    // turn symbol fields into content object
    const content = Object.entries(symbol.fields).reduce((accumulator, [_, field]) => {
      accumulator[field.key] = getPlaceholderValue(field)
      return accumulator
    }, {})

    symbol.content = {
      'en': content
    }
  }

  symbol.fields = symbol.fields.map(Field)

  return symbol
}

export function validateSiteStructure(site) {

  let validated
  try {
    if (defined_structure(site, ['html'])) validated = convertSite(site)
    else if (defined_structure(site, ['content'])) validated = updateSite(site)
    else validated = null
  } catch (e) {
    console.warn('Site is invalid', site)
    validated = null
  }

  return validated

  function updateSite(site) {
    return {
      ...site,
      fields: convertFields(site.fields),
      symbols: site.symbols.map(symbol => ({
        ...symbol,
        fields: convertFields(symbol.fields)
      }))
    }
  }

  function convertSite(site) {

    const siteContent = {}
    const updated = {
      id: site.id,
      name: site.name,
      // pages: convertPages(site.pages, (page) => {
      //   siteContent[page.id] = page.content
      // }),
      code: convertCode(site),
      symbols: convertSymbols(site.symbols),
      fields: convertFields(site.fields, (field) => {
        siteContent[field.id] = field.content
      }),
      content: {
        en: null
      }
    }
    updated.content['en'] = siteContent

    return updated

    function convertPages(pages = [], fn = (_) => { }) {
      return pages.map((page) => {
        const pageContent = {}
        const updatedPage = {
          id: page.id,
          name: page.name || page.title || '',
          sections: convertSections(page.sections, (section) => {
            pageContent[section.id] = section.content
          }),
          code: convertCode(page),
          fields: convertFields(page.fields, (field) => {
            pageContent[field.id] = field.content
          }),
          pages: convertPages(page.pages)
        }
        fn({
          id: page.id,
          content: pageContent
        })
        return updatedPage
      })

      function convertSections(sections, cb) {
        return sections.filter(s => s.type !== 'options').map(section => {
          cb({
            id: section.id,
            content: section.value.fields ? _.chain(section.value.fields).keyBy('key').mapValues('value').value() : section.value.html
          })
          return {
            id: section.id,
            type: section.type,
            ...(section.symbolID ? { symbolID: section.symbolID } : {})
          }
        })
      }
    }

    function convertCode(obj) {
      return {
        html: obj.html,
        css: obj.css,
        js: obj.js || ''
      }
    }
  }

}

export function convertSymbols(symbols) {
  return symbols.map(symbol => ({
    type: 'symbol',
    id: symbol.id,
    name: symbol.title || '',
    code: {
      html: symbol.value.html,
      css: symbol.value.css,
      js: symbol.value.js
    },
    fields: convertFields(symbol.value.fields)
  }))
}

export function convertFields(fields = [], fn = () => { }) {
  return fields.map(field => {
    fn({
      id: field.key,
      content: field.value
    })
    return {
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      fields: convertFields(field.fields),
      options: field.options || {},
      default: field.default || '',
      is_static: field.is_static || false,
    }
  })
}


// https://stackoverflow.com/questions/24924464/how-to-check-if-object-structure-exists
function defined_structure(obj, attrs) {
  var tmp = obj;
  for (let i = 0; i < attrs.length; ++i) {
    if (tmp[attrs[i]] == undefined)
      return false;
    tmp = tmp[attrs[i]];
  }
  return true;
}