import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY } from '$env/static/public';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLIC_KEY, {
	// auth: {
	//   autoRefreshToken: true,
	//   persistSession: true,
	// },
	realtime: {
		params: {
			eventsPerSecond: 10
		}
	}
});

export async function sign_up({ email, password }) {
	let { data, error } = await supabase.auth.signUp({ email, password });
	return { data, error };
}

export async function sign_in({ email, password }) {
	let { data, error } = await supabase.auth.signInWithPassword({ email, password });
	return { data, error };
}

export async function sign_out() {
	await supabase.auth.signOut();
}

export async function create_row(table, row) {
	const { data, error } = await supabase.from(table).insert([row]).select().single();
	if (error) console.error(error);
	return data;
}
