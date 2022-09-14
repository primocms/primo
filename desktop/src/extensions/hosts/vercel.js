import axios from '$lib/libraries/axios';

export async function create_or_update_site({ name, files, token }) {
	console.log({ name, files, token });
	const { data } = await axios.post(
		'https://api.vercel.com/v12/now/deployments',
		{
			name,
			files,
			projectSettings: {
				framework: null,
			},
			target: 'production',
		},
		{
			headers: {
				Authorization: `Bearer ${token}`,
			},
		}
	);

	return data;
}

export default {
	create_or_update_site,
};
