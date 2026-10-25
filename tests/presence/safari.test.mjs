import {test} from 'node:test'
import {fixture,assert,fs,delay} from './fixture.mjs'
import {openScopedSafariSite} from '../staging/hosted/safari-editor.mjs'

test('native Safari sign-in, content-only edit/reorder/reload and synthetic local publication', {timeout:360000},async t=>{
 assert.equal(process.env.GITHUB_ACTIONS,'true','Native Safari runs only in its disposable CI environment')
 const c=await fixture(t),endpoint=new URL(process.env.PRIMO_QA_SAFARI_WEBDRIVER)
 assert.equal(endpoint.origin,'http://127.0.0.1:4444')
 const command=async(method,route,body)=>{const response=await fetch(endpoint.origin+route,{method,signal:AbortSignal.timeout(65000),headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();assert.ok(response.ok&&!data.value?.error,c.redact('Safari WebDriver command failed: '+method+' '+route.split('/').slice(-1)[0]+' '+(data.value?.error||'')+' '+String(data.value?.message||'').slice(0,500)));return data.value}
 const report={...c.provenance,status:'RUNNING',sessions:[],syntheticLoopbackPublication:false,externalCredentialsUsed:false,hostedServiceModified:false}
 let session
 t.after(async()=>{if(session)await command('DELETE',session).catch(()=>{});report.status=report.sessions.length===3&&report.sessions.every(s=>s.status==='PASS')?'PASS_NATIVE_SAFARI':'FAIL';await fs.writeFile('presence-safari.json',JSON.stringify(report,null,2)+'\n')})
 for(let attempt=0;attempt<3;attempt++){
  const record={attempt:attempt+1,status:'FAIL',checks:[]};report.sessions.push(record)
  const opened=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'safari',platformName:'mac',pageLoadStrategy:'eager'}}});session='/session/'+encodeURIComponent(opened.sessionId)
  report.browser={name:opened.capabilities.browserName,version:opened.capabilities.browserVersion,platform:opened.capabilities.platformName}
  await command('POST',session+'/timeouts',{implicit:0,pageLoad:60000,script:15000})
  const execute=(script,args=[])=>command('POST',session+'/execute/sync',{script,args})
  const wait=async(check,label,timeout=90000)=>{const end=Date.now()+timeout;do{if(await check())return;await delay(200)}while(Date.now()<end);assert.fail(label)}
  const element=async selector=>{const result=await command('POST',session+'/element',{using:'css selector',value:selector});return result['element-6066-11e4-a52e-4f735466cecf']}
  const click=async id=>{
   const reference={'element-6066-11e4-a52e-4f735466cecf':id}
   let previous
   // Native Safari does not auto-wait for dialog/repeater layout updates.
   // Observe stable, exposed geometry before issuing one native click.
   await wait(async()=>{
    const rect=await execute("const el=arguments[0];el.scrollIntoView({block:'center',inline:'nearest'});const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;const hit=document.elementFromPoint(x,y);return !el.disabled&&r.width>0&&r.height>0&&getComputedStyle(el).visibility==='visible'&&(hit===el||el.contains(hit))?[r.left,r.top,r.width,r.height]:null",[reference])
    const stable=rect&&JSON.stringify(rect)===JSON.stringify(previous);previous=rect;return stable
   },'Safari control must be exposed and stable before native click',15000)
   return command('POST',session+'/element/'+encodeURIComponent(id)+'/click',{})
  }
  const type=(id,text)=>command('POST',session+'/element/'+encodeURIComponent(id)+'/value',{text})
  const button=async label=>{const value=await execute("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]||b.getAttribute('aria-label')===arguments[0])",[label]);assert.ok(value,'Missing Safari action: '+label);return value['element-6066-11e4-a52e-4f735466cecf']}
  const ready=()=>wait(()=>execute("const frames=[...document.querySelectorAll('main iframe[title=block]')];return frames.length===5&&frames.every(f=>f.contentDocument?.querySelector('h1[contenteditable=true]'))"),'All Safari blocks must become editable')
  const saved=()=>wait(()=>execute(`return !document.querySelector('[role="status"][aria-label="Content save status"]')`),'Safari must finish saving before reload')
  const observeErrors=()=>execute("if(!window.__presenceErrorObserver){window.__presenceErrorObserver=true;const resizeDeliveries=[];const NativeResizeObserver=window.ResizeObserver;window.ResizeObserver=function(callback){const stack=new Error().stack;return new NativeResizeObserver(function(entries,observer){resizeDeliveries.push({stack,targets:entries.map(e=>({tag:e.target.tagName,id:e.target.id,classes:String(e.target.className?.baseVal||e.target.className||'').slice(0,80)}))});if(resizeDeliveries.length>12)resizeDeliveries.shift();return callback.call(this,entries,observer)})};window.ResizeObserver.prototype=NativeResizeObserver.prototype;const originalError=console.error;console.error=function(...args){if(args[0]==='Primo client error:'){const details=JSON.parse(sessionStorage.getItem('presence-client-errors')||'[]');details.push({message:args[1]?.message,stack:args[1]?.stack,name:args[1]?.name});sessionStorage.setItem('presence-client-errors',JSON.stringify(details))}return originalError.apply(this,args)};for(const event of ['error','unhandledrejection'])addEventListener(event,e=>{let errors=JSON.parse(sessionStorage.getItem('presence-errors')||'[]');errors.push(String(e.reason?.message||e.message||e.reason));sessionStorage.setItem('presence-errors',JSON.stringify(errors));const details=JSON.parse(sessionStorage.getItem('presence-error-details')||'[]');details.push({type:event,message:String(e.reason?.message||e.message||e.reason),stack:e.reason?.stack,filename:e.filename,line:e.lineno,resizeDeliveries:String(e.message).startsWith('ResizeObserver')?[...resizeDeliveries]:undefined});sessionStorage.setItem('presence-error-details',JSON.stringify(details))})}return true")
  try{
   record.phase='clear-origin-storage'
   // Safari can retain origin storage across WebDriver sessions. Clear it on an
   // inert same-origin document, before the app can start an auth-refresh redirect.
   await command('POST',session+'/url',{url:c.origin+'/api/health'});await execute('localStorage.clear();sessionStorage.clear();return true');await command('DELETE',session+'/cookie');await command('POST',session+'/url',{url:c.origin+'/admin/auth'});await observeErrors()
   await wait(()=>execute("return ['input[type=email]','input[type=password]','button[type=submit]'].every(selector=>{const el=document.querySelector(selector);return el&&!el.disabled&&el.getClientRects().length})"),'Safari sign-in form missing')
   record.phase='native-email-entry';await type(await element('input[type=email]'),c.actors.editor.email)
   record.phase='native-password-entry';await type(await element('input[type=password]'),c.actors.editor.password)
   record.phase='native-sign-in-submit';await click(await element('button[type=submit]'))
   record.phase='scoped-editor-load'
   await openScopedSafariSite(command,session,c.origin);await ready();await observeErrors()
   record.checks.push('Fresh native password sign-in; one assigned site; all five production editor blocks editable')
   if(attempt===0){
    record.phase='native-content-edit-reorder'
    const own=c.before.filter(e=>e.section===c.section.id),field=key=>c.fields.find(f=>f.key===key),alpha=own.find(e=>e.field===field('name').id&&e.value==='Alpha').parent
    const roots=own.filter(e=>e.field===field('items').id&&!e.parent).sort((a,b)=>a.index-b.index),links=own.filter(e=>e.field===field('links').id&&e.parent===alpha).sort((a,b)=>a.index-b.index)
    const tag='Native Safari saved content'
    const frame=await element('main iframe[title=block]');await command('POST',session+'/frame',{id:{'element-6066-11e4-a52e-4f735466cecf':frame}})
    const heading=await element('h1[data-key=heading]');await click(heading);await command('POST',session+'/element/'+heading+'/clear',{});await type(heading,tag);await type(heading,'\uE004')
    await wait(async()=>(await c.api('/api/collections/page_section_entries/records/'+c.heading.id,{token:c.actors.editor.auth.token})).value===tag,'Safari keyboard content save failed')
    await command('POST',session+'/frame',{id:null});await saved();await command('POST',session+'/refresh',{});await ready();await observeErrors()
    // The block toolbar follows native pointer hover, including after reload.
    const hoverFrame=await element('main iframe[title=block]');await command('POST',session+'/frame',{id:{'element-6066-11e4-a52e-4f735466cecf':hoverFrame}})
    const hoverHeading=await element('h1[data-key=heading]')
    await command('POST',session+'/actions',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:100,origin:{'element-6066-11e4-a52e-4f735466cecf':hoverHeading},x:0,y:0}]}]})
    await command('POST',session+'/frame',{id:null});await wait(()=>execute("return [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Edit Block Content')"),'Safari block hover did not reveal its content action')
    record.phase='open-block-content';await click(await button('Edit Block Content'))
    const row=id=>'[role=dialog] .RepeaterFieldItem[data-entry-id="'+id+'"]'
    assert.equal(await execute("return [...document.querySelectorAll('[role=dialog] button')].some(b=>b.textContent.trim()==='Create Field')"),false)
    const moveItem=async id=>{
     const trigger=await element(row(id)+' > .repeater-item-container > .item-options > .primo-buttons button[aria-label^="Rearrange "]')
     await click(trigger)
     const menuId=await execute("return arguments[0].getAttribute('aria-controls')",[{'element-6066-11e4-a52e-4f735466cecf':trigger}]);assert.ok(menuId,'Safari move trigger must own its menu')
     await wait(()=>execute("return !!document.getElementById(arguments[0])?.querySelector('[role=menuitem]')",[menuId]),'Safari move menu missing')
     const action=await execute("return [...document.getElementById(arguments[0]).querySelectorAll('[role=menuitem]')].find(el=>el.textContent.trim()==='Move earlier')",[menuId]);assert.ok(action,'Safari Move earlier action missing')
     await click(action['element-6066-11e4-a52e-4f735466cecf'])
     await wait(()=>execute("return !document.getElementById(arguments[0])?.getClientRects().length",[menuId]),'Safari move menu must close')
    }
    record.phase='move-root-repeater';await moveItem(roots[1].id)
    record.phase='expand-root-repeater'
    if(!await execute("return !!document.querySelector(arguments[0]+' textarea')?.getClientRects().length",[row(alpha)]))await click(await element(row(alpha)+' button.title'))
    await wait(()=>execute("return !!document.querySelector(arguments[0]+' textarea')?.getClientRects().length",[row(alpha)]),'Safari root item must remain expanded')
    record.phase='move-nested-repeater';await moveItem(links[1].id)
    record.phase='save-repeater-dialog';await click(await button('Save'));await wait(()=>execute("return !document.querySelector('[role=dialog]')"),'Safari content dialog did not save')
    for(let n=0;n<3;n++){
     await saved();await command('POST',session+'/refresh',{});await ready();await observeErrors();const after=await c.verifyContent(tag)
     assert.equal(after.find(e=>e.id===roots[1].id).index,0);assert.equal(after.find(e=>e.id===links[1].id).index,0)
    }
    record.checks.push('Native keyboard edit; root/nested move controls; save and four reloads retain all content IDs, values, bindings and order; no schema creation')
    const errors=await execute("return JSON.parse(sessionStorage.getItem('presence-errors')||'[]')");assert.deepEqual(errors,[],'Safari reload must not log presence rejection');record.unhandledErrors=errors
    record.phase='native-loopback-publication';await click(await button('Publish'));await delay(500)
    const confirmation=await execute("const d=document.querySelector('[role=dialog]');return d&&[...d.querySelectorAll('button')].find(b=>/publish|confirm/i.test(b.textContent))")
    if(confirmation)await click(confirmation['element-6066-11e4-a52e-4f735466cecf'])
    await wait(async()=>(await fetch(c.origin).then(r=>r.text())).includes(tag),'Safari synthetic local browser publication failed')
    report.syntheticLoopbackPublication=true;record.checks.push('Exact CMS browser compiler publishes only the generated loopback fixture')
    await command('POST',session+'/url',{url:c.origin+'/'})
    await wait(()=>execute("return document.querySelector('[data-primo-qa-heading]')?.textContent===arguments[0]",[tag]),'Safari synthetic page has stale text')
    await execute("window.__headings=[...document.querySelectorAll('[data-primo-qa-heading]')];return true")
    await click(await element('[data-primo-qa-counter]'));await wait(()=>execute("return document.querySelector('[data-primo-qa-counter]')?.textContent==='Count 1'"),'Safari published counter must work',15000)
    assert.equal(await execute("return window.__headings.length===5&&window.__headings.every((node,i)=>node===document.querySelectorAll('[data-primo-qa-heading]')[i])"),true)
    record.checks.push('Published content and native interaction correct; all five post-load heading nodes retained')
    // Restore generated fixture values before independent fresh sign-ins.
    for(const entry of c.before){const after=(await c.entries()).find(e=>e.id===entry.id);if(entry.index!==after.index||JSON.stringify(entry.value)!==JSON.stringify(after.value))await c.api('/api/collections/page_section_entries/records/'+entry.id,{method:'PATCH',body:{value:entry.value,index:entry.index},token:c.actors.editor.auth.token})}
    await c.verifyContent()
   }else{
    await command('POST',session+'/refresh',{});await ready();await observeErrors();await c.verifyContent();assert.deepEqual(await execute("return JSON.parse(sessionStorage.getItem('presence-errors')||'[]')"),[])
    record.checks.push('Independent fresh sign-in/reload; all original stored content retained; zero observed unhandled errors')
   }
   assert.deepEqual(await execute("return JSON.parse(sessionStorage.getItem('presence-client-errors')||'[]')"),[],'Caught client router errors must also fail Safari qualification')
   record.phase='complete';record.status='PASS'
  }catch(error){record.failure=c.redact(error.message);record.diagnostic=await execute("return {path:location.pathname,clientErrorDetails:JSON.parse(sessionStorage.getItem('presence-client-errors')||'[]'),errorDetails:JSON.parse(sessionStorage.getItem('presence-error-details')||'[]'),ready:document.readyState,text:document.body.innerText.slice(0,1800),loader:document.querySelector('#app-boot-loader')?.outerHTML,scripts:[...document.scripts].map(s=>({src:s.src,type:s.type})),resources:performance.getEntriesByType('resource').map(r=>({path:new URL(r.name).pathname,status:r.responseStatus,duration:r.duration,bytes:r.transferSize})),buttons:[...document.querySelectorAll('button')].map(b=>({label:b.getAttribute('aria-label'),text:b.textContent.trim().slice(0,80)})),frames:[...document.querySelectorAll('main iframe[title=block]')].map(f=>({editable:!!f.contentDocument?.querySelector('h1[contenteditable=true]')}))}").catch(()=>null);
   if(record.phase==='clear-origin-storage'&&record.diagnostic){
    // Diagnose already requested application modules only after a failed native
    // navigation. Re-importing a failed ESM exposes its cached rejection; this
    // never converts the failed session into a qualification pass.
    record.diagnostic.moduleProbe=await command('POST',session+'/execute/async',{script: `const done=arguments[arguments.length-1];const urls=[...new Set(performance.getEntriesByType('resource').map(r=>r.name).filter(name=>{const u=new URL(name);return u.origin===location.origin&&['chunks','nodes','entry'].some(dir=>u.pathname.startsWith('/admin/_app/immutable/'+dir+'/'))&&u.pathname.endsWith('.js')}))];Promise.all(urls.map(url=>Promise.race([import(url).then(module=>({path:new URL(url).pathname,status:'loaded',routeStates:Object.entries(module).flatMap(([name,value])=>{try{return value&&typeof value==='object'&&'error'in value&&'status'in value&&'url'in value?[{name,status:value.status,path:value.url?.pathname,route:value.route?.id,error:value.error?{name:value.error.name,message:value.error.message,stack:value.error.stack}:null}]:[]}catch(error){return[{name,diagnosticError:String(error)}]}})}),error=>({path:new URL(url).pathname,status:'error',message:String(error?.message||error),stack:error?.stack})),new Promise(resolve=>setTimeout(()=>resolve({path:new URL(url).pathname,status:'pending'}),2000))]))).then(done,error=>done({error:String(error)}))`,args:[]}).catch(error=>({diagnosticFailure:c.redact(error.message)}))
    record.diagnostic.bodyHTML=await execute('return document.body.innerHTML.slice(0,5000)').catch(()=>null)
   }
   throw Error(record.failure)
  }
  finally{await command('DELETE',session);session=null}
 }
 console.log({...report,status:'PASS_NATIVE_SAFARI'})
})
