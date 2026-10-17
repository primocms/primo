import { Context } from 'runed'
import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
import type { Sites, Pages, PageTypes } from '$lib/pocketbase/collections'

// Define typed contexts
export const site_context = new Context<{ value: ObjectOf<typeof Sites> }>('site')
export const page_context = new Context<{ value: ObjectOf<typeof Pages> }>('page')
export const page_type_context = new Context<{ value: ObjectOf<typeof PageTypes> | null | undefined }>('page_type')

// Environment and debugging contexts
export const debugging_context = new Context<boolean>('DEBUGGING')
export const environment_context = new Context<'DESKTOP' | 'SERVER' | 'TRY'>('ENVIRONMENT')

// Field visibility contexts
export const hide_dynamic_field_types_context = new Context<boolean>('hide_dynamic_field_types')
export const hide_page_field_field_type_context = new Context<boolean>('hide_page_field_field_type')
export const hide_site_field_field_type_context = new Context<boolean>('hide_site_field_field_type')
