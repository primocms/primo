import { writable, derived } from 'svelte/store'
import { Site } from '../../factories'

export const id = writable('default')
export const url = writable('')
export const name = writable('')
export const fields = writable([])
export const code = writable(Site().code)
export const entries = writable(Site().entries)

export const design = writable(Site().design)
export const subscriptions = writable([])
export const distribution_domain_name = writable('')
export const validation_record = writable(null)
export const custom_domain = writable('')
export const custom_domain_connected = writable(false)
export const custom_domain_validated = writable(false)

export function update(props) {
	if (props.id) {
		id.set(props.id)
	}
	if (props.url) {
		url.set(props.url)
	}
	if (props.name) {
		name.set(props.name)
	}
	if (props.code) {
		code.set(props.code)
	}
	if (props.fields) {
		fields.set(props.fields)
	}
	if (props.entries) {
		entries.set(props.entries)
	}
	if (props.design) {
		design.set(props.design)
	}
	if (props.subscriptions) {
		subscriptions.set(props.subscriptions)
	}
	if (props.distribution_domain_name) {
		distribution_domain_name.set(props.distribution_domain_name)
	}
	if (props.validation_record) {
		validation_record.set(props.validation_record)
	}
	if (props.custom_domain) {
		custom_domain.set(props.custom_domain)
	}
	if (props.custom_domain_connected) {
		custom_domain_connected.set(props.custom_domain_connected)
	}
	if (props.custom_domain_validated) {
		custom_domain_validated.set(props.custom_domain_validated)
	}
}

// conveniently get the entire site
/** @type {import('svelte/store').Readable<import('$lib').Site>} */
export const site = derived(
	[
		id,
		url,
		name,
		code,
		fields,
		entries,
		design,
		subscriptions,
		distribution_domain_name,
		validation_record,
		custom_domain,
		custom_domain_connected,
		custom_domain_validated
	],
	([
		id,
		url,
		name,
		code,
		fields,
		entries,
		design,
		subscriptions,
		distribution_domain_name,
		validation_record,
		custom_domain,
		custom_domain_connected,
		custom_domain_validated
	]) => {
		return {
			id,
			url,
			name,
			code,
			fields,
			entries,
			design,
			subscriptions,
			distribution_domain_name,
			validation_record,
			custom_domain,
			custom_domain_connected,
			custom_domain_validated
		}
	}
)

export default site
