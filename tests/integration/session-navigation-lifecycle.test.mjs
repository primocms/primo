import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {parse} from 'svelte/compiler'

// Execute the actual layout lifecycle callbacks with a delayed session result.
// An unmounted editor must not send Back into its old auth redirect.
for(const route of ['dashboard','sites/[site_id]','site']){
 const source=await fs.readFile(new URL(`../../src/routes/${route}/+layout.svelte`,import.meta.url),'utf8')
 const statements=parse(source).instance.content.body.filter(node=>
  node.type==='VariableDeclaration' && node.declarations.some(d=>d.id.name==='active') ||
  node.type==='ExpressionStatement' && ['onMount','onDestroy'].includes(node.expression.callee?.name))
 const script=statements.map(node=>source.slice(node.start,node.end)).join('\n')
 for(const leave of [false,true])test(`${route}: ${leave?'an unmounted':'an active'} session failure ${leave?'cannot redirect to the departing editor':'redirects to login'}`,async()=>{
  let resolve,mount,destroy=()=>{},refreshes=0;const redirects=[]
  const pending=new Promise(done=>{resolve=done})
  new Function('onMount','onDestroy','check_session','goto','auth_url','page','refresh_author_mode',script)(
   callback=>{mount=callback},callback=>{destroy=callback},()=>pending,
   async url=>{redirects.push(url)},()=>'/admin/auth?redirect=old-editor',{url:new URL('https://cms.test/admin/sites/old-editor')},()=>{refreshes++})
  const completed=mount()
  if(leave)destroy()
  resolve(false);await completed
  assert.deepEqual(redirects,leave?[]:['/admin/auth?redirect=old-editor'])
  if(route!=='dashboard')assert.equal(refreshes,1)
 })
}
