import {find} from 'lodash'
import {writable,get} from 'svelte/store'
import {pages} from '../data/draft'
import {DEFAULTS, createPage} from '../../const'
import {unsaved} from './misc'

export const id = writable('index')

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
  pages.update(pages => pages.map(page => page.id === get(id) ? ({
    ...page,
    ...prop
  }) : page))
  unsaved.set(true)
}
