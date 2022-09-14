import axios from '$lib/libraries/axios';

export async function createSite({ zip, token }) {
	const { data } = await axios.post('https://api.netlify.com/api/v1/sites', zip, {
		headers: {
			'Content-Type': 'application/zip',
			Authorization: `Bearer ${token}`,
		},
	});
	return {
		id: data.id,
		url: `https://${data.subdomain}.netlify.app`,
	};
}

export async function updateSite({ id, zip, token }) {
	const { data } = await axios.put(`https://api.netlify.com/api/v1/sites/${id}`, zip, {
		headers: {
			'Content-Type': 'application/zip',
			Authorization: `Bearer ${token}`,
		},
	});
}

export default {
	createSite,
	updateSite,
};
