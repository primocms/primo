import _ from 'lodash'
import {writable,get,derived} from 'svelte/store'
import {pages} from '../data/draft'
import {DEFAULTS, createPage} from '../../const'
import {unsaved} from './misc'

export const id = writable('index')

// When a store in here is changed, updatePage is run to save those values to site.pages (as a draft)

export const content = writable(DEFAULTS.content)
content.subscribe(content => {
  updatePage({ content })
})

export const dependencies = writable(DEFAULTS.dependencies)
dependencies.subscribe(dependencies => {
  updatePage({ dependencies })
})

export const styles = writable(DEFAULTS.styles)
styles.subscribe(styles => {
  updatePage({ styles })
})

export const wrapper = writable(DEFAULTS.wrapper)
wrapper.subscribe(wrapper => {
  updatePage({ wrapper })
})

export const fields = writable(DEFAULTS.fields)
fields.subscribe(fields => {
  updatePage({ fields })
})

function updatePage(prop) {
	const [ root, child ] = get(id).split('/')
  if (!child) {
    const pageToUpdate = _.find(get(pages), ['id', root]) 
    pages.update(
      pages => pages.map(page => page.id === root ? ({
        ...page,
        ...prop
      }) : page)
    )
  } else {
    pages.update(
      pages => pages.map(page => page.id === root ? ({
        ...page,
        pages: page.pages.map(page => page.id === child ? ({
          ...page,
          ...prop
        }) : page)
      }) : page)
    )
  }

  pages.update(pages => pages.map(page => page.id === get(id) ? ({
    ...page,
    ...prop
  }) : page))
  unsaved.set(true)
}


// conveniently get the entire site
export default derived(
  [ content, dependencies, styles, wrapper, fields ], 
  ([content, dependencies, styles, wrapper, fields]) => {
  return {
    // ...createSite(),
    content, 
    dependencies, 
    styles, 
    wrapper, 
    fields
  }
})
