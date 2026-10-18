/** Move layout writes out of ResizeObserver delivery and coalesce notifications.
 * @param {() => void} update
 * @param {{requestFrame?: typeof requestAnimationFrame, cancelFrame?: typeof cancelAnimationFrame}} options
 */
export function createResizeTask(update, {requestFrame = callback => window.requestAnimationFrame(callback), cancelFrame = id => window.cancelAnimationFrame(id)} = {}) {
 let active = true
 /** @type {number | undefined} */
 let frame
 return {
  schedule() {
   if (!active || frame !== undefined) return
   frame = requestFrame(() => {
    frame = undefined
    if (active) update()
   })
  },
  dispose() {
   active = false
   if (frame !== undefined) cancelFrame(frame)
   frame = undefined
  }
 }
}
