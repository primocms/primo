import { supabase } from '$lib/supabase'
import {get_on_page_symbol_sections} from '../stores/helpers'

export async function get_off_page_sibling_sections(section_id, symbol_id) {
  const on_page_sibling_ids = get_on_page_symbol_sections(symbol_id).map(s => s.id)
  const excluded_section_ids = [...on_page_sibling_ids, section_id]
  let [{ data: direct_block_instances}, { data: indirect_block_instances}] = await Promise.all([
		supabase
			.from('sections')
			.select('*, entries(*)')
			.eq('symbol', symbol_id)
			.not('id', 'in', `(${excluded_section_ids.join(',')})`),
		supabase.from('sections').select('*, entries(*), master!inner(symbol)').eq('master.symbol', symbol_id)
	])

  return [ ...(direct_block_instances || []), ...(indirect_block_instances || [])].map(section => ({
    ...section,
    entries: section.entries || []
  }))
}

export async function get_symbol_sections(symbol_id) {
  const on_page_sibling_ids = get_on_page_symbol_sections(symbol_id).map(s => s.id)
  let [{ data: direct_block_instances }, { data: indirect_block_instances }] = await Promise.all([
		supabase
			.from('sections')
			.select('*, entries(*), symbol')
			.eq('symbol', symbol_id)
			.not('id', 'in', `(${Object.keys(on_page_sibling_ids).join(',')})`),
		supabase.from('sections').select('*, entries(*), master!inner(symbol)').eq('master.symbol', symbol_id)
	])

  return [...(direct_block_instances || []), ...(indirect_block_instances || [])].map(section => ({
    ...section,
    entries: section.entries || []
  }))
}