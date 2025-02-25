/**
 * @typedef {Object} File
 * @property {string} data - The data content of the file.
 * @property {string} file - The name of the file.
 * @property {number} size - The size of the file in bytes.
 */

/**
 * @typedef {Object} DeploymentPayload
 * @property {Array<File>} files - Array containing files to be deployed.
 * @property {string} site_id - The unique identifier for the site where the files will be deployed.
 * @property {string} repo_name - The name of the repository where the files will be stored.
 */

/**
 * @typedef {Object} DeploymentResponse
 * @property {Object} repo - Information about the repository where the files are stored.
 * @property {number} created - Unix timestamp representing when the deployment was created.
 * @property {string} deploy_id - A unique identifier for the deployment.
 */

let listener = () => {}

/**
 * Used externally to listen for deployments & perform the deployment.
 *
 * @async
 * @param {function} fn - The function to be invoked during deployment.
 * @param {DeploymentPayload} fn.payload - The site bundle & destination repo.
 * @param {boolean} fn.create_new - Flag indicating whether a new repository should be created if it doesn't exist.
 * @returns {Promise<{DeploymentResponse}>} - A Promise that resolves to an object containing details of the deployment.
 */
export function deploy_subscribe(fn) {
	listener = fn
}

export function deploy_unsubscribe() {
	listener = null
}

/**
 * Used internally to deploy the site
 * @param {DeploymentPayload} payload - The site bundle & destination repo
 * @param {boolean} action - Which action to take related to deployment
 * @returns {Promise<DeploymentResponse>}
 */
export async function deploy(payload, action) {
	// When data changes, notify the listener
	return await listener(payload, action)
}
