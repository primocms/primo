import {find} from 'lodash'
import {writable,get} from 'svelte/store'
import {pages} from '../data/draft'
import {DEFAULTS} from '../../const'
import {unsaved} from './misc'

export const id = writable('index')

function updatePage(prop) {
  pages.update(pages => pages.map(page => page.id === get(id) ? ({
    ...page,
    ...prop
  }) : page))
  unsaved.set(true)
}

export const content = writable(DEFAULTS.content)
content.subscribe(content => {
  updatePage({ content })
})


export const dependencies = writable(DEFAULTS.dependencies)
dependencies.subscribe(dependencies => {
  updatePage({ dependencies })
})