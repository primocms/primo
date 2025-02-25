import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash-es'
import { Field_Row, Page, Site, Symbol } from './factories'
import convert_v2_to_v3 from '../components/convert_site_object'

/**
 *
 * @param {function} fn - The function to be invoked during deployment.
 * @param {DeploymentPayload} fn.payload - The site bundle & destination repo.
 * @param {boolean} fn.create_new - Flag indicating whether a new repository should be created if it doesn't exist.
 * @returns {import('$lib').Site_Data} - A Promise that resolves to an object containing details of the deployment.
 */
export function convert_site_v3(data) {
	console.log({ data })
	if (data.version === 2) {
		return convert_v2_to_v3(data)
	} else if (data.version === 3) {
		return data
	}
}

export function validate_site_data(data) {
	try {
		// Check if data has all required properties
		const required_keys = ['site', 'pages', 'page_types', 'sections', 'symbols']
		const missing_keys = required_keys.filter(key => !(key in data))
		
		if (missing_keys.length > 0) {
			throw new Error(`Missing required properties: ${missing_keys.join(', ')}`)
		}

		// Validate arrays
		if (!Array.isArray(data.pages)) throw new Error('pages must be an array')
		if (!Array.isArray(data.page_types)) throw new Error('page_types must be an array')
		if (!Array.isArray(data.sections)) throw new Error('sections must be an array')
		if (!Array.isArray(data.symbols)) throw new Error('symbols must be an array')

		// Validate site object
		const required_site_keys = ['id', 'name', 'code', 'design', 'entries', 'fields']
		const missing_site_keys = required_site_keys.filter(key => !(key in data.site))
		
		if (missing_site_keys.length > 0) {
			throw new Error(`Site object missing required properties: ${missing_site_keys.join(', ')}`)
		}

		// Validate design object
		const required_design_keys = ['heading_font', 'body_font', 'primary_color', 'radius', 'shadow']
		const missing_design_keys = required_design_keys.filter(key => !(key in data.site.design))
		
		if (missing_design_keys.length > 0) {
			throw new Error(`Design object missing required properties: ${missing_design_keys.join(', ')}`)
		}

		return true
	} catch (error) {
		console.error('Site data validation failed:', error.message)
		return false
	}
}

