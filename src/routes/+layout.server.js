/** @type {import('@sveltejs/kit').ServerLoad} */
export const load = async ({ locals: { getSession } }) => {
  return {
    session: await getSession(),
  }
}