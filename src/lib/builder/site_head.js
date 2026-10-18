import {isEqual,cloneDeep} from 'lodash-es'
import {startPreviewTask} from './preview_task.js'

/** Own one site-head compilation across input changes, reload and disposal.
 * @param {{compile: (input: {html: string, data: object}) => Promise<string>, onResult: (head: string) => void, onError: (error: unknown) => void}} options
 */
export function createSiteHeadPreview({compile,onResult,onError}) {
 /** @type {{html: string, data: object} | undefined} */
 let previous
 /** @type {ReturnType<typeof startPreviewTask> | undefined} */
 let task
 return {
  /** @param {{html: string, data: object | undefined}} input */
  update(input) {
   if (!input.data || isEqual(previous,input)) return task?.settled
   previous=cloneDeep({html:input.html,data:input.data})
   task?.cancel()
   const current={html:input.html,data:input.data}
   task=startPreviewTask({run:()=>compile(current),onResult,onError,onSettled:()=>{}})
   return task.settled
  },
  cancel() { task?.cancel(); previous=undefined }
 }
}
