import _ from 'lodash'
import {writable,get,derived} from 'svelte/store'
import {pages} from '../data/draft'
import {DEFAULTS, createPage} from '../../const'
import {unsaved} from './misc'

export const id = writable('index')

// When a store in here is changed, updatePage is run to save those values to site.pages (as a draft)

export const content = writable(DEFAULTS.content)

export const styles = writable(DEFAULTS.styles)
styles.subscribe(styles => {
  // updatePage({ styles })
})

export const wrapper = writable(DEFAULTS.wrapper)
// wrapper.subscribe(wrapper => {
//   updatePage({ wrapper })
// })

export const fields = writable(DEFAULTS.fields)
fields.subscribe(fields => {
  // updatePage({ fields })
})

function updatePage(prop) {
	const [ root, child ] = get(id).split('/')
  if (!child) {
    pages.update(
      pages => pages.map(page => {
        if (page.id === root) {
          return {
            ...page,
            ...prop
          }
        } else return page
      })
    )
  } else {
    pages.update(
      pages => pages.map(page => {
        if (page.id === root) {
          return {
            ...page,
            pages: page.pages.map(subpage => {
              if (subpage.id === child) {
                return {
                  ...subpage,
                  ...prop
                }
              } else return subpage
            })
          }
        } else return page
      })
    )
  }

  pages.update(pages => pages.map(page => page.id === get(id) ? ({
    ...page,
    ...prop
  }) : page))
  // unsaved.set(true)
}


// conveniently get the entire site
export default derived(
  [ content, styles, wrapper, fields ], 
  ([content, styles, wrapper, fields]) => {
  return {
    // ...createSite(),
    content, 
    styles, 
    wrapper, 
    fields
  }
})
