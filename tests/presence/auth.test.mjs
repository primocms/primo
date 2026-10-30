import {test} from 'node:test'
import {chromium,firefox,webkit,expect} from '@playwright/test'
import {fixture,assert,fs,path} from './fixture.mjs'
import {submitPassword} from './auth-window.mjs'
import {authPlan} from './auth-plan.mjs'
const engine=process.env.PRIMO_BROWSER||'chromium',plan=authPlan()
test(engine+' fresh production sign-in renders and opens only the assigned site',{timeout:plan.timeout},async t=>{
 const c=await fixture(t),browser=await {chromium,firefox,webkit}[engine].launch({headless:true})
 const errors=[],sessions=[]
 const report={...c.provenance,status:'FAIL',browser:engine,browserVersion:browser.version(),platform:process.platform,node:process.version,pageErrors:errors,sessions}
 try {
  for(const [attempt,session] of plan.sessions.entries()){
   const {burst,profile,scenario}=session,started=performance.now(),record={scenario,profile,status:'FAIL',phase:'load form',authResponses:[],canceledAuthRefresh:0,recoveredAuthRefresh:0}
   sessions.push(record)
   const context=await browser.newContext();await context.tracing.start({screenshots:true,snapshots:true})
   const page=await context.newPage();page.on('pageerror',error=>errors.push(c.redact(error.message)))
   page.on('response',response=>{
    const pathname=new URL(response.url()).pathname
    if(!/\/users\/auth-(with-password|refresh)$/.test(pathname))return
    c.noteAuthResponse();record.authResponses.push({path:pathname,status:response.status(),elapsedMs:Math.round(performance.now()-started)})
    if(pathname.endsWith('/auth-refresh')&&response.ok())record.recoveredAuthRefresh++
   })
   page.on('requestfailed',request=>{
    const pathname=new URL(request.url()).pathname
    if(/\/users\/auth-(with-password|refresh)$/.test(pathname))record.authResponses.push({path:pathname,transportFailure:true,elapsedMs:Math.round(performance.now()-started)})
   })
   if(profile==='delayed-canceled'){
    record.delayedPasswordRequests=0;record.delayedRefreshRequests=0
    await page.route('**/api/collections/users/auth-with-password',async route=>{record.delayedPasswordRequests++;await new Promise(resolve=>setTimeout(resolve,250));await route.continue()})
   }
   if(profile!=='normal')await page.route('**/api/collections/users/auth-refresh',async route=>{
    if(!record.canceledAuthRefresh){record.canceledAuthRefresh++;await route.abort('failed')}
    else {if(profile==='delayed-canceled'){record.delayedRefreshRequests++;await new Promise(resolve=>setTimeout(resolve,500))};await route.continue()}
   })
   try {
    await page.goto(c.origin+'/admin/auth')
    await page.evaluate(()=>{
     const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem
     Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='pocketbase_auth'&&!JSON.parse(value||'{}').token)sessionStorage.setItem('qa-session-cleared','true');return set.call(this,key,value)}
     Storage.prototype.removeItem=function(key){if(this===localStorage&&key==='pocketbase_auth')sessionStorage.setItem('qa-session-cleared','true');return remove.call(this,key)}
    })
    if(burst){
     record.phase='exhaust fixture login budget';await c.waitForAuthWindow()
     for(let n=0;n<2;n++)await c.api('/api/collections/users/auth-with-password',{method:'POST',body:{identity:c.actors.editor.email,password:c.actors.editor.password}})
     record.phase='observe real password rejection before refresh'
     await assert.rejects(submitPassword(page,c.actors.editor),/Password sign-in returned HTTP 429; refresh verification has not started/)
     await page.getByRole('alert').waitFor();assert.equal(record.canceledAuthRefresh,0);assert.equal(record.recoveredAuthRefresh,0)
     record.rateLimitRejectionVisible=true
    }
    record.phase='wait for seeded auth budget';record.authWindowWaitMs=await c.waitForAuthWindow()
    if(burst)assert.ok(record.authWindowWaitMs>0,'The regression must exercise the real rate-limit quiet period')
    record.phase='password response';await submitPassword(page,c.actors.editor)
    record.phase='refresh recovery'
    await expect.poll(()=>record.recoveredAuthRefresh,{timeout:10000}).toBeGreaterThan(0)
    await page.waitForURL('**/admin/dashboard/sites');await page.locator('.site-card-footer a').waitFor()
    assert.equal(await page.locator('.site-card').count(),1)
    assert.equal(record.canceledAuthRefresh,profile==='normal'?0:1)
    if(profile==='delayed-canceled'){assert.equal(record.delayedPasswordRequests,1);assert.ok(record.delayedRefreshRequests>=1)}
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('qa-session-cleared')),null,'Transport failures must not discard a valid session')
    assert.deepEqual(errors,[]);await c.verifyContent()
    record.status='PASS';record.phase='complete';record.durationMs=Math.round(performance.now()-started)
    console.log(`${engine} sign-in ${attempt+1}/${plan.sessions.length}: ${scenario} PASS (${record.durationMs}ms)`)
    await context.tracing.stop()
   }catch(error){
    record.durationMs=Math.round(performance.now()-started)
    record.failure=c.redact(String(error.message))
    record.ui=await page.evaluate(()=>({pathname:location.pathname,alert:document.querySelector('[role=alert]')?.textContent,submitDisabled:document.querySelector('button[type=submit]')?.disabled,formValid:document.querySelector('form')?.checkValidity(),sessionPresent:!!JSON.parse(localStorage.getItem('pocketbase_auth')||'{}').token})).catch(()=>null)
    if(record.ui?.alert)record.ui.alert=c.redact(record.ui.alert)
    const trace=path.resolve(process.env.PRIMO_AUTH_TRACE_DIR||'.','auth-'+engine+'-'+attempt+'-trace.zip')
    await fs.mkdir(path.dirname(trace),{recursive:true});await context.tracing.stop({path:trace}).catch(()=>{})
    throw error
   }finally{await context.close()}
  }
  assert.deepEqual((await c.api('/api/settings',{token:c.admin.token})).rateLimits,c.authLimits,'Qualification must not weaken the production rate limits')
  Object.assign(report,{status:'PASS_FRESH_SCOPED_SIGN_IN',freshPasswordSignIn:true,assignedSites:1,contentAndAllIdsRetained:true,canceledAuthRefresh:sessions.reduce((n,s)=>n+s.canceledAuthRefresh,0),recoveredAuthRefresh:sessions.reduce((n,s)=>n+s.recoveredAuthRefresh,0),validSessionPreserved:true,rateLimitPolicyUnchanged:true,seededBurstRecovered:true})
 }finally{
  await fs.writeFile('auth-'+engine+'.json',JSON.stringify(report,null,2)+'\n');await browser.close()
 }
 console.log(report)
})
