/** @type {import('@sveltejs/kit').ServerLoad} */
export async function load(event) {
	event.depends('app:data')
}
