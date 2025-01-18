// import { error as server_error } from '@sveltejs/kit';

// /** @type {import('@sveltejs/kit').ServerLoad} */
// export const load = async ({ url, locals }) => {
// 	const session = await locals.getSession();
// 	if (!session) {
// 		// the user is not signed in
// 		throw server_error(401, { message: 'Unauthorized' });
// 	}

// 	return {
// 		// supabase,
// 		session
// 	};
// };
