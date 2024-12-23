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
export function validate_site_structure_v3(data) {
	console.log({ data })
	if (data.version === 2) {
		return convert_v2_to_v3(data)
	} else if (data.version === 3) {
		return data
	}
}



