import _ from 'lodash'
import { createStack } from '../../libraries/svelte-undo';
import {get} from 'svelte/store'
import site from './draft'
import pages from './pages'
import sections from './sections'
import symbols from './symbols'

export default {
  site, 
  pages, 
  sections,
  symbols
}

export function get_data() {
  return {
    site: get(site),
    pages: get(pages),
    sections: get(sections),
    symbols: get(symbols)
  }
}

export let timeline = createStack({
  doing: () => {console.log('initial doing')},
  undoing: () => {console.log('initial undoing')},
  data: get_data()
});

export function set_timeline(data) {
	timeline.set({
    doing: () => {console.log('set_timeline')},
    undoing: () => {console.log('set timeline undoing')},
    data
  });
}

export async function update_timeline({ doing, undoing } = { doing: () => {}, undoing: () => {}}) {
  await doing()
  timeline.push({
    doing,
    undoing,
    data: get_data()
  })
}