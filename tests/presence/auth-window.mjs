/** Keep fixture traffic out of the real password-login rate-limit window. */
export function createAuthWindow({windowMs, now = () => performance.now(), pause = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
 let lastResponse = -Infinity
 return {
  mark() { lastResponse = now() },
  async wait() {
   let waited = 0
   // A response observed while waiting extends the quiet period too.
   for (;;) {
    const remaining = windowMs > 0 ? Math.ceil(lastResponse + windowMs + 100 - now()) : 0
    if (remaining <= 0) return waited
    await pause(remaining); waited += remaining
   }
  }
 }
}

export function authWindowMs(limits) {
 if (!limits.enabled) return 0
 const rules = limits.rules.filter(rule => rule.label === '*:auth')
 if (!rules.length) throw new Error('Disposable fixture must declare its auth rate-limit policy')
 return Math.max(...rules.map(rule => rule.duration * 1000))
}

/** Observe the password response before judging the separate refresh stage. */
export async function submitPassword(page, {email, password}) {
 await page.locator('input[type=email]').fill(email)
 await page.locator('input[type=password]').fill(password)
 const [response] = await Promise.all([
  page.waitForResponse(response => new URL(response.url()).pathname === '/api/collections/users/auth-with-password'),
  page.locator('button[type=submit]').click()
 ])
 if (response.status() !== 200) throw new Error(`Password sign-in returned HTTP ${response.status()}; refresh verification has not started`)
 await response.finished()
 return response
}
