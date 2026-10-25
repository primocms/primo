/**
 * Own the asynchronous preview result for one reactive input/lifetime. A
 * synchronous try/catch cannot observe a compiler promise that rejects later.
 * @template T
 * @param {{run: () => Promise<T>, onResult: (result: T) => void, onError: (error: unknown) => void, onSettled: () => void}} options
 */
export function startPreviewTask({run, onResult, onError, onSettled}) {
 let active = true
 const settled = (async () => {
  try {
   const result = await run()
   if (active) onResult(result)
  } catch (error) {
   if (active) onError(error)
  } finally {
   if (active) onSettled()
  }
 })()
 return {settled, cancel: () => { active = false }}
}
