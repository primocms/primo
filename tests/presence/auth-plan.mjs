/** Bounded, opt-in stress coverage; normal qualification keeps its original budget. */
export function authPlan(env = process.env) {
 const repeats = Number(env.PRIMO_AUTH_REPEATS || 1)
 if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error('PRIMO_AUTH_REPEATS must be an integer from 1 to 20')
 if (env.PRIMO_AUTH_STRESS && env.PRIMO_AUTH_STRESS !== '1') throw new Error('PRIMO_AUTH_STRESS must be 1 or unset')
 const profiles = env.PRIMO_AUTH_STRESS === '1' ? ['normal', 'canceled', 'delayed-canceled'] : ['canceled']
 const sessions = Array.from({length: repeats}, (_, i) => profiles.map(profile => ({profile, scenario: `${profile} sign-in ${i + 1}`}))).flat()
 sessions.push({profile: 'canceled', scenario: 'seeded auth burst and visible 429', burst: true})
 return {sessions, timeout: Math.max(240000, 120000 + sessions.length * 15000)}
}
