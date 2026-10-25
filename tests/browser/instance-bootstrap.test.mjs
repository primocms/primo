import {test} from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import http from 'node:http'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
import {chromium} from '@playwright/test'
const root=fileURLToPath(new URL('../../',import.meta.url))
const settings={id:'bootstrap-fixture',version:'test',telemetry_enabled:true,smtp_enabled:true,hosted_mode:true,dev_mode:false,site_count:2,library_block_count:3,domain_provider:'railway',base_domain:'example.test'}
async function fixture(t){
 const outdir=path.join(root,'virtual-bootstrap-build')
 const result=await build({entryPoints:{instance:path.join(root,'src/lib/instance.ts'),hooks:path.join(root,'src/hooks.client.ts')},bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',write:false,outdir,logLevel:'silent',plugins:[{name:'bootstrap-transport-only',setup(b){
  b.onResolve({filter:/^\.\/pocketbase\/instances$/},()=>({path:'clients',namespace:'test'}))
  b.onResolve({filter:/^\$lib\/instance$/},()=>({path:path.join(root,'src/lib/instance.ts')}))
  b.onResolve({filter:/^\$lib\/PostHog$/},()=>({path:'analytics',namespace:'test'}))
  b.onResolve({filter:/^\$lib\/analytics$/},()=>({path:'tracking',namespace:'test'}))
  b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:{clients:'export const self={baseURL:location.origin};',analytics:'export const initialized=Promise.resolve();',tracking:'export const track_uncaught_error=()=>{};'}[args.path],loader:'js'}))
 }}]})
 const files=new Map(result.outputFiles.map(file=>['/'+path.relative(outdir,file.path),file.text]))
 const server=http.createServer((request,response)=>{const name=new URL(request.url,'http://localhost').pathname;if(files.has(name)){response.writeHead(200,{'Content-Type':'text/javascript'});response.end(files.get(name))}else{response.writeHead(200,{'Content-Type':'text/html'});response.end('<!doctype html><div id="app-boot-loader">Loading Primo</div>')}})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve))})
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
 const origin='http://127.0.0.1:'+server.address().port;let requested
 const request=new Promise(resolve=>{requested=resolve});await page.route(origin+'/api/primo/info',route=>requested(route));await page.goto(origin)
 const load=async()=>{await page.evaluate(()=>{window.moduleReady=false;window.moduleImport=import('/instance.js').then(module=>{window.instanceModule=module;window.moduleReady=true});window.moduleImport.catch(()=>{})});const route=await request;await page.waitForFunction(()=>window.moduleReady,null,{timeout:5000});return route}
 const start=()=>page.evaluate(()=>{window.bootstrapped=false;window.initCalled=false;window.initFinished=import('/hooks.js').then(hooks=>{window.initCalled=true;return hooks.init()}).then(()=>{window.bootstrapped=true;return true},error=>{window.bootstrapError=error.message;return false});return true})
 return{page,errors,load,start,release:(route,status=200,body=settings)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})}
}
test('settings metadata does not suspend module initialization',async t=>{
 const f=await fixture(t),route=await f.load()
 assert.equal(await f.page.evaluate(()=>instanceModule.instance.telemetry_enabled),false)
 await f.release(route);await f.page.evaluate(()=>instanceModule.instance_ready)
 assert.deepEqual(await f.page.evaluate(()=>({...instanceModule.instance})),settings);assert.deepEqual(f.errors,[])
})
test('the client startup barrier waits for real settings before allowing the application to mount',async t=>{
 const f=await fixture(t),route=await f.load();await f.start();await f.page.waitForFunction(()=>window.initCalled)
 assert.equal(await f.page.evaluate(()=>window.bootstrapped),false)
 await f.release(route);assert.equal(await f.page.evaluate(()=>window.initFinished),true)
 assert.deepEqual(await f.page.evaluate(()=>({...instanceModule.instance})),settings);assert.deepEqual(f.errors,[])
})
test('a settings failure keeps startup closed and replaces the boot spinner with a visible error',async t=>{
 const f=await fixture(t),route=await f.load();await f.start();await f.page.waitForFunction(()=>window.initCalled)
 await f.release(route,503);assert.equal(await f.page.evaluate(()=>window.initFinished),false)
 assert.equal(await f.page.evaluate(()=>window.bootstrapped),false)
 assert.match(await f.page.getByRole('alert').innerText(),/could not connect/i)
 assert.deepEqual(f.errors,[])
})

test('a malformed successful settings response cannot unlock startup or enable telemetry',async t=>{
 const f=await fixture(t),route=await f.load();await f.start();await f.page.waitForFunction(()=>window.initCalled)
 await f.release(route,200,{smtp_enabled:true});assert.equal(await f.page.evaluate(()=>window.initFinished),false)
 assert.equal(await f.page.evaluate(()=>instanceModule.instance.telemetry_enabled),false)
 assert.equal(await f.page.evaluate(()=>window.bootstrapped),false);await f.page.getByRole('alert').waitFor();assert.deepEqual(f.errors,[])
})
