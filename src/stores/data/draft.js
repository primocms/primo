import { writable } from 'svelte/store';
import { createSite, createPage, DEFAULTS } from '../../const'

const site = writable( createSite() )

export const pages = writable([ createPage() ])
export const dependencies = writable(DEFAULTS.dependencies)
export const styles = writable(DEFAULTS.styles)
export const wrapper = writable(DEFAULTS.wrapper)
export const fields = writable([])
export const symbols = writable([])