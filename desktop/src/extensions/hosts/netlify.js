import axios from '$lib/libraries/axios';
import {chain, find} from 'lodash-es'

export async function createSite({ files, token }) {
	const {data} = await uploadFiles({
		endpoint: 'https://api.netlify.com/api/v1/sites',
		files,
		token
	})
	if (data) {
		return {
			id: data.id,
			deploy_id: data.deploy_id,
			url: `https://${data.subdomain}.netlify.com`,
			created: Date.now(),
		}
	} else return null
}

export async function updateSite({ id, files, token }) {
	const {data} = await uploadFiles({
		endpoint: `https://api.netlify.com/api/v1/sites/${id}/deploys`,
		files,
		token
	})
	if (data) {
		return {
			id: data.site_id,
			deploy_id: data.id,
			url: data.ssl_url,
			created: Date.now(),
		}
	} else return null
}

async function uploadFiles({ endpoint, files, token }) {
	let error = 'Could not upload files to Netlify'
	const filesToUpload = 
		chain(
			await Promise.all(
				files.map(async f => {
					const hash = await digestMessage(f.data);
					return ({ 
						hash, 
						file: `/${f.file}`
					})
				})
			)
		)
		.keyBy('file')
		.mapValues('hash')
		.value()

	// upload hashes to netlify
	const res = await axios
		.post(
			endpoint,
			{
				"files": filesToUpload
			},
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
			}
		)

	// upload missing files
	if (res.data) {
		const {required, id, deploy_id} = res.data // deploy_id for new site, id for existing site (!?)
		await Promise.all(
			required.map(async (hash) => {
				const fileName = Object.keys(filesToUpload).find(key => filesToUpload[key] === hash)
				const {data} = find(files, ['file', fileName.slice(1)])
				await axios.put(`https://api.netlify.com/api/v1/deploys/${deploy_id || id}/files${fileName}`, 
					data, 
					{
						headers: {
							'Content-Type': 'application/octet-stream',
							Authorization: `Bearer ${token}`
						}
				})
			})
		)
		return { data: res.data, error: null }
	} else return { data: null, error }
}

// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
async function digestMessage(message) {
	const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);           // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
	return hashHex;
}

export default {
	createSite,
	updateSite,
};
