/** Share compiler downloads and bound both headers and response-body waits.
 * Failed downloads are evicted so a later compilation can try again.
 * @param {{fetchModule?: typeof fetch, timeoutMs?: number, setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout}} options
 */
export function createModuleLoader({fetchModule=fetch,timeoutMs=10000,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
 /** @type {Map<string, Promise<string>>} */
 const modules=new Map()
 /** @param {string} id */
 async function download(id) {
  for(let attempt=0;attempt<2;attempt++) {
   const controller=new AbortController()
   /** @type {ReturnType<typeof setTimeout> | undefined} */
   let timer
   const timeout=new Promise((_,reject)=>{
    timer=setTimer(()=>{const error=new Error(`Module download timed out: ${id}`);controller.abort();reject(error)},timeoutMs)
   })
   try {
    const request=Promise.resolve().then(()=>fetchModule(id,{signal:controller.signal})).then(response=>{
     if(!response.ok)throw Object.assign(new Error(`Failed to fetch ${id}: ${response.status} ${response.statusText}`),{status:response.status})
     return response.text()
    })
    return /** @type {string} */ (await Promise.race([request,timeout]))
   }catch(error) {
    const status=/** @type {{status?: number}} */(error)?.status
    if(attempt===1 || (status && status<500 && status!==408 && status!==429))throw error
   }finally{clearTimer(timer)}
  }
  throw new Error(`Failed to fetch ${id}`)
 }
 /** @param {string} id */
 return function load(id) {
  const cached=modules.get(id)
  if(cached)return cached
  const pending=download(id).catch(error=>{
   if(modules.get(id)===pending)modules.delete(id)
   throw error
  })
  modules.set(id,pending)
  return pending
 }
}
