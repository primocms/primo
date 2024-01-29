<script>
	import _ from 'lodash'
	import Primo, { database_subscribe, storage_subscribe, deploy_subscribe } from '@primocms/builder'
	import axios from 'axios'

	export let data

	const { supabase } = data

	deploy_subscribe(async (untyped_payload, create_new) => {
		// workaround because adding the type next to the argument throws a parsing error (?)
		/** @type {import('@primocms/builder/src/lib/deploy.js').DeploymentPayload} */
		const payload = untyped_payload

		if (create_new) {
			await deploy_to_server({
				site_id: payload.site_id,
				repo_name: payload.repo_name,
				create_new: true,
				message: 'Create site',
				provider: payload.provider
			})
		}

		if (payload.provider === 'github') {
			const chunks = chunk_payload(payload, 4500) // break payload up into chunks to avoid cloud function body limits
			const blob_list = (await Promise.all(chunks.map(create_blob_list))).flat()
			return await deploy_to_server({
				...payload,
				files: blob_list,
				message: `Deploy site`
			})

			async function create_blob_list(chunk) {
				const { data } = await axios.post('/api/deploy/blobs', chunk).catch((e) => {
					console.error({ e })
					return { data: null }
				})
				return data
			}

			function chunk_payload(payload, max_size) {
				const chunks = []
				payload.files.forEach((file) => {
					const current_chunk = chunks[chunks.length - 1]
					const current_chunk_size = current_chunk
						? current_chunk.files.reduce((acc, payload) => acc + file.size, 0)
						: 0
					if (current_chunk && current_chunk_size + file.size < max_size) {
						// current chunk below limit
						current_chunk.files.push(file)
					} else {
						// create new chunk
						chunks.push({
							...payload,
							files: [file]
						})
					}
				})
				return chunks
			}
		} else if (payload.provider === 'gitlab') {
			return await deploy_to_server({
				...payload,
				files: payload.files.map((file) => ({
					path: file.file,
					content: file.data
				})),
				message: `Deploy site`
			})
		}

		async function deploy_to_server(chunk) {
			const {
				data: { error, deployment }
			} = await axios.post('/api/deploy', chunk).catch((e) => {
				return { data: { error: e.message, deployment: null } }
			})
			if (error) {
				console.log('Deployment error: ', error)
				return null
			} else {
				return deployment
			}
		}
	})

	database_subscribe(async ({ table, action, data, id, match, order }) => {
		console.log('Accessing database', { table, action, data, id, match, order })
		let res
		if (action === 'insert') {
			res = await supabase.from(table).insert(data)
		} else if (action === 'update') {
			res = await supabase.from(table).update(data).eq('id', id)
		} else if (action === 'delete') {
			if (id) {
				res = await supabase.from(table).delete().eq('id', id).select()
			} else if (match) {
				res = await supabase.from(table).delete().match(match).select()
			}
		} else if (action === 'upsert') {
			res = await supabase.from(table).upsert(data)
		} else if (action === 'select') {
			if (order) {
				res = await supabase
					.from(table)
					.select(data)
					.match(match)
					.order(...order)
			} else {
				res = await supabase.from(table).select(data).match(match)
			}
		}
		if (res.error) {
			console.log('Database error: ', {
				res,
				query: { table, action, data, id, match, order }
			})
		}
		return res.data
	})

	storage_subscribe(async ({ bucket, action, key, file, options }) => {
		if (action === 'upload') {
			await supabase.storage.from(bucket).upload(key, file, options)
			if (bucket === 'images') {
				const { data: res } = supabase.storage.from(bucket).getPublicUrl(key)
				return res.publicUrl
			}
		}
	})
</script>

<Primo
	role={data.user.role}
	data={{
		site: data.site,
		pages: data.pages,
		symbols: data.symbols
	}}
>
	<slot />
</Primo>
