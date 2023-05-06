import _ from 'lodash'
import { createStack } from '../../libraries/svelte-undo';
import {get} from 'svelte/store'
import site from './site'
import pages from './pages'
import sections from './sections'
import symbols from './symbols'

export default {
  site, 
  pages, 
  sections,
  symbols
}

export let timeline = createStack({
  doing: () => {console.log('initial doing')},
  undoing: () => {console.log('initial undoing')}
});

/** @param {{ doing: () => Promise<void>, undoing: () => Promise<void> }} functions */
export async function update_timeline({ doing, undoing }) {
  await doing()
  timeline.push({
    doing,
    undoing
  })
}