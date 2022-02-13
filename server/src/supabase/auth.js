import supabase from './core'

export async function signUp({ email, password }) {
  const res = await supabase.auth.signUp({ email, password })
  return res
}

export async function signInWithGithub({ redirectTo = '/dashboard' }) {
  console.log({redirectTo})
  const { user, session, error } = await supabase.auth.signIn({
    // provider can be 'github', 'google', 'gitlab', or 'bitbucket'
    provider: 'github'
  }, {
    scopes: 'public_repo',
    redirectTo
  })
  console.log({user,session,error})
}

export function watchForAutoLogin(cb) {
  supabase.auth.onAuthStateChange(cb)
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function signIn({ email, password }) {
  return await supabase.auth.signIn({ email, password })
}

export async function resetPassword(email) {
  return supabase.auth.api.resetPasswordForEmail(email)
}

export const auth = supabase.auth

export default {
  signUp,
  signIn,
  signInWithGithub,
  signOut,
  resetPassword,
  watchForAutoLogin
}