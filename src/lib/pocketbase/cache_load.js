/** Own cache loads so cancellation cannot poison a placeholder or erase a winner.
 * @param {{setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout}} options
 */
export function createCacheLoads({setTimer = setTimeout, clearTimer = clearTimeout} = {}) {
 /** @type {Map<string, {timer?: ReturnType<typeof setTimeout>}>} */
 const active = new Map()
 /** @type {Map<string, number>} */
 const delays = new Map()
 return {
  /** @param {string} key */
  begin(key) {
   clearTimer(active.get(key)?.timer)
   /** @type {{timer?: ReturnType<typeof setTimeout>}} */
   const request = {}
   active.set(key, request)
   const current = () => active.get(key) === request
   return {
    /** @param {() => void} apply */
    settle(apply) {
     if (!current()) return
     clearTimer(request.timer)
     // Let the caller's catch still own the load if applying a malformed
     // response throws; it must be able to replace the loading placeholder.
     apply()
     if (current()) { active.delete(key); delays.delete(key) }
    },
    /** @param {() => void} invalidate */
    retry(invalidate) {
     if (!current()) return
     const delay = delays.get(key) ?? 250
     delays.set(key, Math.min(delay * 2, 5000))
     clearTimer(request.timer)
     request.timer = setTimer(() => {
      if (!current()) return
      active.delete(key); invalidate()
     }, delay)
    }
   }
  }
 }
}
