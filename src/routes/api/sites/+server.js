import supabaseAdmin from '../../../supabase/admin';
import { authorizeRequest } from '../_auth';
import {json} from '@sveltejs/kit'

export async function GET(event) {
	return await authorizeRequest(event, async () => {
		let finalSites = [];
		const { data: sites } = await supabaseAdmin.from('sites').select('*');
		await Promise.all(
			sites.map(async site => {

				const [ data, preview ] = await Promise.all([
					downloadFile(`${site.id}/site.json`),
					downloadFile(`${site.id}/preview.html`)
				])

				finalSites = [
					...finalSites,
					{
						...site,
						data: JSON.parse(data),
						preview
					},
				];
			})
		);
		return json(finalSites)
	});

	async function downloadFile(location) {
		const {data} = await supabaseAdmin.storage.from('sites').download(`${location}?${Date.now()}`) // bust the cache (i.e. prevent outdated data)
		return await data.text()
	}
}
