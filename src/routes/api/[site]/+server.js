import supabaseAdmin, { saveSite } from '../../../supabase/admin';
import { authorizeRequest } from '../_auth';
import { publishSite } from '../_hosts';
import { decode } from 'base64-arraybuffer';
import {json} from '@sveltejs/kit'

export async function GET(event) {
	return await authorizeRequest(event, async () => {
		const { data } = await supabaseAdmin.storage.from('sites').download(`${event.params.site}/site.json?${Date.now()}`);
		const body = JSON.stringify(await data.text());
		return json({ body })
	});
}

export async function POST(event) {
	return await authorizeRequest(event, async () => {
		const { action, payload } = await event.request.json();

		if (action === 'ADD_USER') {
			// create user (email, password) in auth

			const { data: users } = await supabaseAdmin
				.from('users')
				.select('*')
				.eq('email', payload.email);
			// const [existingUser] = users.filter(u => u.email === payload.email)
			const [existingUser] = users;
			if (existingUser) {
				const { error } = await supabaseAdmin.auth.signInWithPassword({
					email: payload.email,
					password: payload.password,
				});
				if (!error) {
					await supabaseAdmin
						.from('users')
						.update({
							sites: [...existingUser.sites, event.params.site],
						})
						.match({ email: payload.email });
				}
			} else {
				const { data: user, error } = await supabaseAdmin.auth.signUp({
					email: payload.email,
					password: payload.password
				});
				if (error) {
					return json({
						body: false,
					})
				}
				// create user in database for site row and user row, give site permission
				await supabaseAdmin.from('users').insert({
					email: payload.email,
					role: payload.role,
					sites: [event.params.site],
				});
			}

			// reset password
			await supabaseAdmin
				.from('sites')
				.update({
					password: null,
				})
				.match({ id: event.params.site });

			return json({
				body: true,
			})
		} else if (action === 'REMOVE_USER') {
			// create user (email, password) in auth
			const { error } = await supabaseAdmin
				.from('users')
				.update({
					sites: (JSON.parse(payload.sites)).filter(s => s !== event.params.site), // not sure why array comes through as JSON
				})
				.match({ email: payload.email });

			if (error) {
				return json({
					body: false,
				})
			}

			return json({
				body: true,
			})
		} else if (action === 'SET_ACTIVE_EDITOR') {
			await Promise.all([
				supabaseAdmin
					.from('sites')
					.update({ active_editor: payload.userID })
					.eq('id', payload.siteID),
				supabaseAdmin.rpc('remove_active_editor', { site: payload.siteID }),
			]);
			return json({
				body: true,
			})
		} else if (action === 'REMOVE_ACTIVE_EDITOR') {
			await supabaseAdmin
				.from('sites')
				.update({ active_editor: '' })
				.eq('id', payload.siteID);
			return json({
				body: true,
			})
		} else if (action === 'UPLOAD_IMAGE') {
			const { siteID, image } = payload;
			await supabaseAdmin.storage.from('sites').upload(`${siteID}/assets/${image.name}`, decode(image.base64), {
				contentType: 'image/png',
			});

			const { data: {publicUrl} } = await supabaseAdmin.storage.from('sites').getPublicUrl(`${siteID}/assets/${image.name}`);

			return json({
				body: publicUrl,
			})
		} else if (action === 'SAVE_SITE') {
			const res = await saveSite(payload.site, payload.preview)
			return json({
				body: !!res,
			})
		} else if (action === 'PUBLISH') {
			const { siteID, files, host } = payload;

			// fetch file data from Supabase
			const fetched_files = await Promise.all(
				files.map(async file => {
					const {data} = await supabaseAdmin.storage.from('sites').download(`${siteID}/site-files/${file}`)
					const file_data = await data.text()
					return {
						file: file,
						data: file_data
					}
				})
			)

			// get active_deployment from db
			const [{ data: hosts }, { data: siteData }] = await Promise.all([
				supabaseAdmin
					.from('hosts')
					.select('*')
					.eq('name', host.name),
				supabaseAdmin
					.from('sites')
					.select('*')
					.eq('id', siteID),
			]);
			const [{ active_deployment }] = siteData;
			const { deployment, error } = await publishSite({
				siteID,
				host: hosts[0],
				files: fetched_files,
				activeDeployment: active_deployment,
			});
			if (deployment) {
				const { data, error } = await supabaseAdmin
					.from('sites')
					.update({
						active_deployment: deployment,
					})
					.eq('id', siteID);
				if (error) console.error(error);
				return json({
					body: {
						deployment,
						error: null,
					},
				})
			} else {
				return json({
					body: {
						deployment: null,
						error: null,
					},
				})
			}
		} else {
			return json({
				body: 'Event undefined',
			})
		}
	});
}