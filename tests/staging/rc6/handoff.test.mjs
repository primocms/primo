import {test} from 'node:test'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const requireCLI=createRequire(path.join(process.env.RC_INSTALL,'node_modules/primo-cli/package.json'))
const mcpEntry=requireCLI.resolve('primo-mcp')
const requireMCP=createRequire(mcpEntry)
const {Client}=await import(pathToFileURL(requireMCP.resolve('@modelcontextprotocol/sdk/client/index.js')))
const {StdioClientTransport}=await import(pathToFileURL(requireMCP.resolve('@modelcontextprotocol/sdk/client/stdio.js')))
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const yamlParser=requireCLI('js-yaml')
import path from 'node:path'
const cliRoot=path.join(process.env.RC_INSTALL,'node_modules/primo-cli')
const {select_dev_port}=await import(pathToFileURL(path.join(cliRoot,'dist/utils/dev-port.js')))
const {read_dev_runtime,runtime_is_running}=await import(pathToFileURL(path.join(cliRoot,'dist/utils/dev-runtime.js')))
import {spawn} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'
import {chromium, firefox, webkit} from '@playwright/test'
const engine = process.env.PRIMO_BROWSER || 'chromium'
const browserType = {chromium,firefox,webkit}[engine]
assert.ok(browserType, engine)
import {make_workspace,run_cli,CLI_ENTRY} from './cli-helper.mjs'
const binary = path.resolve(process.env.PRIMO_TEST_CMS_BINARY)

test('founding builder: init, file authoring, dev, conflicts, publish, client invite and republish', {timeout:480000}, async t=>{
 const ws=await make_workspace();t.after(ws.cleanup)
 const options={cwd:ws.work,home:ws.home,timeout_ms:45000}
 const cli=(args,opts={})=>run_cli(args,{...options,...opts})
 const ok=async(args,opts)=>{const r=await cli(args,opts);assert.equal(r.code,0,r.output);return r}
 assert.equal((await ok(['--version'])).stdout.trim(),'0.3.0-rc.2');
 await ok(['init','--no-mcp']); console.log('PASS initialize actual built CLI workspace')
 const port=await select_dev_port({port:Number(process.env.RC_PORT || 48500),explicit:false})
 const server=`http://127.0.0.1:${port}`
 await fs.writeFile(path.join(ws.work,'server.yaml'),`port: ${port}\n`)
 await ok(['new','client','--skip-dev'])
 const site=path.join(ws.work,'sites/client')
 const mcp=new Client({name:'founding-handoff-qa',version:'1.0.0'})
 const transport=new StdioClientTransport({command:process.execPath,args:[mcpEntry],cwd:ws.work,stderr:'pipe'})
 await mcp.connect(transport);t.after(()=>mcp.close());assert.equal(mcp.getServerVersion().version,'0.1.11-rc.2')
 const call=async(name,args={})=>{const result=await mcp.callTool({name,arguments:args});assert.ok(!result.isError,JSON.stringify(result));return result.structuredContent??JSON.parse(result.content.find(c=>c.type==='text').text)}
 await call('list_docs');await call('get_docs',{section:'recommended-defaults'})
 for(const [name,args] of [['scaffold_block',{name:'banner',fields:[{name:'heading',type:'text'}]}],['scaffold_page_type',{name:'default',allowed_blocks:['banner'],fields:[{name:'seo_title',type:'text'},{name:'seo_description',type:'text'},{name:'og_image',type:'image'}]}]]) {
  const result=await call(name,args);assert.ok(result.files?.length,JSON.stringify(result))
  for(const file of result.files){await fs.mkdir(path.dirname(path.join(site,file.path)),{recursive:true});await fs.writeFile(path.join(site,file.path),file.contents)}
 }
 console.log('PASS actual packaged MCP session: reference guidance and block/page-type scaffolding')
 const files={
  'site/head.svelte':'<title>Founding client</title>',
  'blocks/banner/config.yaml':'name: Banner\n',
  'blocks/banner/fields.yaml':'- name: heading\n  type: text\n- name: items\n  label: Items\n  type: repeater\n  subfields:\n    - name: name\n      label: Name\n      type: text\n    - name: details\n      label: Details\n      type: group\n      subfields:\n        - name: links\n          label: Links\n          type: repeater\n          subfields:\n            - name: label\n              label: Label\n              type: text\n',
  'blocks/banner/component.svelte':'<script>let {heading,items=[]}=$props(); let count=$state(0)</script><h1>{heading}</h1><ul data-testid="client-items">{#each items as item}<li><span>{item.name}</span><ul>{#each item.details?.links ?? [] as link}<li>{link.label}</li>{/each}</ul></li>{/each}</ul><button onclick={() => count++}>{count}</button><style>h1 {color:red}</style>',
  'page-types/default/config.yaml':'name: Default\nallowed_blocks: [banner]\n',
  'pages/index.yaml':'name: Home\npage_type: default\nsections:\n'+Array.from({length:5},(_,i)=>`  - block: banner\n    content:\n      heading: Client section ${i}\n${i===0 ? "      items:\n        - name: Alpha\n          details:\n            links:\n              - label: First nested link\n              - label: Second nested link\n        - name: Bravo\n          details:\n            links: []\n        - name: Charlie\n          details:\n            links: []\n" : "      items: []\n"}`).join(''),
  'pages/about.yaml':'name: About\npage_type: default\nsections: []\n'
 }
 for(const [file,data] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(site,file)),{recursive:true});await fs.writeFile(path.join(site,file),data)}
 for(const [name,args] of [['validate_block',{site_path:site,name:'banner'}],['validate_page',{site_path:site,page_path:'pages/index.yaml'}],['validate_page',{site_path:site,page_path:'pages/about.yaml'}],['validate_site',{site_path:site}]]) {
  const result=await call(name,args);assert.equal(result.ok,true,JSON.stringify(result))
 }
 console.log('PASS agent-authored files validated through the packaged MCP: two pages and five block instances')
 const dev=spawn(process.execPath,[CLI_ENTRY,'dev','--author','both','--port',String(port)],{cwd:ws.work,env:{...process.env,HOME:ws.home,USERPROFILE:ws.home,PRIMO_BINARY:binary,PRIMO_MCP_LOCAL:mcpEntry,PRIMO_ENABLE_USAGE_STATS:'false'},stdio:['ignore','pipe','pipe']})
 let logs='';dev.stdout.on('data',b=>logs+=b);dev.stderr.on('data',b=>logs+=b)
 t.after(async()=>{if(dev.exitCode===null){const closed=new Promise(r=>dev.once('close',r));dev.kill('SIGTERM');await closed}})
 let auth
 for(let i=0;i<200;i++){try{const r=await fetch(`${server}/api/primo/dev-auth`,{method:'POST'});if(r.ok){auth=await r.json();break}}catch{}if(dev.exitCode!==null)break;await delay(100)}
 assert.ok(auth?.token,logs)
 const api=async(route,{method='GET',data,token=auth.token}={})=>{const r=await fetch(server+route,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});assert.ok(r.ok,`${method} ${route}: ${r.status} ${await r.clone().text()}`);return r.status===204?null:r.json()}
 assert.equal((await api('/api/primo/info')).version,'v3.3.2-rc.6');console.log('PASS exact CLI, MCP and CMS candidate versions verified at runtime')
 let sites
 for(let i=0;i<100;i++){sites=await api('/api/collections/sites/records');if(sites.items.length)break;await delay(100)}
 const id=sites.items.find(s=>s.name.toLowerCase().includes('client'))?.id;assert.ok(id)
 for(let i=0;i<150;i++){const runtime=await read_dev_runtime(ws.work);if(runtime&&await runtime_is_running(runtime))break;await delay(100)}
 const status=JSON.parse((await ok(['status','--json'])).stdout);assert.equal(status.running,true,JSON.stringify(status)+logs)
 const registered=JSON.parse(await fs.readFile(path.join(ws.work,'.mcp.json'),'utf8')).mcpServers.primo
 assert.deepEqual(registered,{command:'node',args:[mcpEntry]})
 const configuredMCP=new Client({name:'configured-candidate-qa',version:'1.0.0'})
 try {
  await configuredMCP.connect(new StdioClientTransport({command:process.execPath,args:registered.args,cwd:ws.work,stderr:'pipe'}))
  assert.equal(configuredMCP.getServerVersion().version,'0.1.11-rc.2')
  const status=await configuredMCP.callTool({name:'get_dev_status',arguments:{site_path:site}})
  assert.ok(!status.isError,JSON.stringify(status))
 } finally { await configuredMCP.close() }
 console.log('PASS generated agent configuration launches the exact installed MCP candidate')
 await call('get_dev_status',{site_path:site})
 console.log('PASS actual built CLI development startup and MCP status')
 const beforeWatch=(await api('/api/collections/page_sections/records?perPage=200')).items.map(s=>s.id).sort()
 const watchedFile=path.join(site,'blocks/banner/component.svelte')
 const watchedSource=(await fs.readFile(watchedFile,'utf8')).replace('<h1>','<h1 data-watch="verified">')
 let watched=false
 for(let i=0;i<80;i++) {
  if(i%10===0) await fs.writeFile(watchedFile,watchedSource)
  const records=(await api('/api/collections/site_symbols/records?perPage=200')).items
  if(records.some(block=>block.html?.includes('data-watch="verified"'))){watched=true;break}
  await delay(100)
 }
 assert.ok(watched,'file watcher failed to import an actual active-workspace block edit')
 assert.deepEqual((await api('/api/collections/page_sections/records?perPage=200')).items.map(s=>s.id).sort(),beforeWatch)
 console.log('PASS upgraded watcher imports active-workspace edits without changing section IDs')
 const filter=encodeURIComponent(`site="${id}"`)
 const types=(await api(`/api/collections/page_types/records?filter=${filter}`)).items
 const home=(await api(`/api/collections/pages/records?filter=${filter}`)).items.find(page=>!page.parent)
 assert.ok(home)
 const created=await api('/api/collections/pages/records',{method:'POST',data:{site:id,parent:home.id,page_type:types[0].id,name:'Contact',slug:'contact'}})
 const block=await api('/api/collections/site_symbols/records',{method:'POST',data:{site:id,name:'Client note',html:'<p>Contact us</p>',js:'',css:''}})
 await api('/api/collections/page_sections/records',{method:'POST',data:{page:created.id,symbol:block.id,index:0}})
 console.log('PASS create page and reusable block through CMS APIs')
 const pullDir=path.join(ws.root,'agency-copy')
 await ok(['pull',server,pullDir,'--token',auth.token])
 const slug=(await fs.readdir(path.join(pullDir,'sites')))[0]
 const copiedSite=path.join(pullDir,'sites',slug)
 const initialHome=yamlParser.load(await fs.readFile(path.join(copiedSite,'pages/index.yaml'),'utf8'))
 const component=path.join(copiedSite,'blocks/banner/component.svelte')
 const edited=(await fs.readFile(component,'utf8')).replace(/color:\s*red/,'color:blue')
 await fs.writeFile(component,edited)
 const entries=(await api('/api/collections/page_section_entries/records?perPage=200')).items
 const entry=entries.find(e=>typeof e.value==='string'&&e.value.includes('Client section 0'));assert.ok(entry)
 await api(`/api/collections/page_section_entries/records/${entry.id}`,{method:'PATCH',data:{value:'Agency CMS edit'}})
 const rejected=await cli(['push','--dir',copiedSite,'--server',server,'--token',auth.token])
 assert.notEqual(rejected.code,0,rejected.output);assert.match(rejected.output,/changed|conflict|pull/i)
 assert.equal(await fs.readFile(component,'utf8'),edited)
 const afterReject=await api(`/api/collections/page_section_entries/records/${entry.id}`)
 console.log(`OBSERVED CMS entry after rejected push: ${JSON.stringify(afterReject.value)}`)
 if(afterReject.value!=='Agency CMS edit') console.log('DEV TRACE '+logs)
 assert.equal(afterReject.value,'Agency CMS edit','CMS edit was lost during two-way sync')
 console.log('PASS stale push rejected; both CMS content and local code retained')
 await ok(['publish','--server',server,'--site',id,'--dir',site,'--token',auth.token,'--json'])
 let publicText=await fetch(`${server}/?_site=${id}`).then(r=>r.text());
 const afterPublish=await api(`/api/collections/page_section_entries/records/${entry.id}`)
 console.log(`OBSERVED CMS entry after publication: ${JSON.stringify(afterPublish.value)}`)
 if(!publicText.includes('Agency CMS edit')) console.log('DEV TRACE '+logs)
 assert.equal(afterPublish.value,'Agency CMS edit','CMS edit lost while publishing')
 assert.match(publicText,/Agency CMS edit/)
 console.log('PASS local publication serves edited content')
 const user=await api('/api/collections/users/records',{method:'POST',data:{email:'founding-client@example.test',password:'TemporaryPassword123!',passwordConfirm:'TemporaryPassword123!'}})
 await api('/api/collections/site_role_assignments/records',{method:'POST',data:{site:id,user:user.id,role:'editor'}})
 const invite=await api('/api/primo/password-link',{method:'POST',data:{site_id:id,user_id:user.id}})
 const resetToken=new URL(invite.link).searchParams.get('create');assert.ok(resetToken)
 await api('/api/collections/users/confirm-password-reset',{method:'POST',data:{token:resetToken,password:'ClientPassword123!',passwordConfirm:'ClientPassword123!'}})
 const client=await api('/api/collections/users/auth-with-password',{method:'POST',data:{identity:'founding-client@example.test',password:'ClientPassword123!'}})
 await api(`/api/collections/page_section_entries/records/${entry.id}`,{method:'PATCH',token:client.token,data:{value:'Client draft headline'}})
 const browser=await browserType.launch({headless:true,...(process.env.PRIMO_BROWSER_CHANNEL ? {channel:process.env.PRIMO_BROWSER_CHANNEL}: {})});console.log('BROWSER '+engine+' '+browser.version());t.after(()=>browser.close())
 const clientContext=await browser.newContext();const clientPage=await clientContext.newPage()
 clientPage.setDefaultTimeout(20000);clientPage.on('pageerror',e=>console.log('CLIENT PAGEERROR '+e.message));clientPage.on('console',m=>{if(m.type()==='error')console.log('CLIENT CONSOLE '+m.text())});clientPage.on('requestfailed',r=>console.log('CLIENT REQUESTFAILED '+r.url()+' '+r.failure()?.errorText))
 await clientPage.addInitScript(({token,record})=>localStorage.setItem('pocketbase_auth',JSON.stringify({token,record})),client)
 await clientPage.goto(`${server}/admin/sites/${id}`)
 await clientPage.waitForFunction(()=>{const frames=[...document.querySelectorAll('main iframe[title=block]')];return frames.length===5&&frames.every(frame=>frame.contentDocument?.querySelector('h1'))},{},{timeout:90000}).catch(async error=>{const state=await Promise.race([clientPage.evaluate(()=>({url:location.href,body:document.body.innerText.slice(0,1200),frames:[...document.querySelectorAll('iframe')].map(f=>({title:f.title,hasDocument:!!f.contentDocument,body:f.contentDocument?.body?.innerText.slice(0,200)}))})).catch(e=>({error:e.message})),delay(3000).then(()=>({evaluation:'blocked'}))]);console.log('EDITOR FAILURE STATE '+JSON.stringify(state));await clientPage.screenshot({path:new URL('../evidence/editor-failure-'+engine+'.png',import.meta.url).pathname,timeout:3000}).catch(()=>{});throw error})
 const clientHeading=clientPage.locator('main iframe[title=block]').first().contentFrame().locator('h1')
 for(let i=0;i<5;i++) {
  await clientHeading.click();await clientPage.keyboard.press('ControlOrMeta+A');await clientPage.keyboard.press('Backspace');await clientPage.keyboard.type('Client approved headline')
  if(await clientHeading.textContent()==='Client approved headline') break
  await delay(200)
 }
 const save=clientPage.waitForResponse(r=>r.url().includes(`/page_section_entries/records/${entry.id}`)&&r.request().method()==='PATCH',{timeout:10000})
 await clientHeading.blur();assert.equal((await save).ok(),true)
 assert.equal((await api(`/api/collections/page_section_entries/records/${entry.id}`)).value,'Client approved headline')

 // Reorder as the invited editor through the exact packaged CMS, then save/reload.
 const repeaterBefore=(await api('/api/collections/page_section_entries/records?perPage=200')).items
 const fields=(await api('/api/collections/site_symbol_fields/records?perPage=200')).items
 const itemField=fields.find(f=>f.key==='items');const nameField=fields.find(f=>f.key==='name')
 const linkField=fields.find(f=>f.key==='links');const labelField=fields.find(f=>f.key==='label')
 const names=repeaterBefore.filter(e=>e.field===nameField.id)
 const alpha=names.find(e=>e.value==='Alpha').parent;const charlie=names.find(e=>e.value==='Charlie').parent
 const nestedSecond=repeaterBefore.find(e=>e.field===labelField.id&&e.value==='Second nested link').parent
 await clientHeading.hover();await clientPage.getByRole('button',{name:'Edit Block Content'}).click()
 const contentDialog=clientPage.getByRole('dialog')
 assert.equal(await contentDialog.getByRole('button',{name:'Create Field',exact:true}).count(),0)
 const itemLocator=id=>contentDialog.locator(`.RepeaterFieldItem[data-entry-id="${id}"]`)
 await itemLocator(charlie).getByRole('button',{name:'Move Item item up',exact:true}).click()
 await itemLocator(charlie).getByRole('button',{name:'Move Item item up',exact:true}).click()
 if(!await itemLocator(alpha).locator('[id$="-name"] textarea').isVisible()) await itemLocator(alpha).locator('button.title').first().click()
 await itemLocator(nestedSecond).getByRole('button',{name:'Move Link item up',exact:true}).click()
 await contentDialog.getByRole('button',{name:'Save',exact:true}).click()
 await contentDialog.waitFor({state:'hidden'})
 await clientPage.reload()
 await clientPage.waitForFunction(()=>document.querySelector('main iframe[title=block]')?.contentDocument?.querySelector('h1'),{},{timeout:90000})
 const repeaterAfter=(await api('/api/collections/page_section_entries/records?perPage=200')).items
 assert.deepEqual(repeaterAfter.map(e=>e.id).sort(),repeaterBefore.map(e=>e.id).sort())
 for(const original of repeaterBefore) {
  const current=repeaterAfter.find(e=>e.id===original.id)
  for(const key of ['field','parent','locale']) assert.deepEqual(current[key],original[key],`${original.id}/${key}`)
  // Group/repeater values are derived import caches. The editor deliberately
  // clears these when children change; compare actual field values and later
  // assert the complete reconstructed nested content in the final pull.
  const field=fields.find(f=>f.id===original.field)
  if(!['group','repeater'].includes(field?.type)) assert.deepEqual(current.value,original.value,`${original.id}/value`)
 }
 const rootItems=repeaterAfter.filter(e=>e.field===itemField.id&&e.section===entry.section&&!e.parent).sort((a,b)=>a.index-b.index)
 assert.deepEqual(rootItems.map(e=>names.find(n=>n.parent===e.id).value),['Charlie','Alpha','Bravo'])
 assert.equal(repeaterAfter.find(e=>e.id===nestedSecond).index,0)
 console.log('PASS invited content-only editor reorders root and nested items; Save/reload retains every entry ID, field value and parent')
 // Use the packaged CMS browser compiler as the content editor before CLI republication.
 const activated=clientPage.waitForResponse(r=>r.url().includes('/api/primo/publication/')&&r.url().endsWith('/activate')&&r.request().method()==='POST',{timeout:90000})
 await clientPage.getByRole('button',{name:'Preview',exact:true}).click()
 const confirm=clientPage.getByRole('dialog').getByRole('button',{name:/publish|preview|confirm/i}).first()
 if(await confirm.isVisible({timeout:2000}).catch(()=>false))await confirm.click()
 assert.equal((await activated).ok(),true)
 assert.match(await fetch(`${server}/?_site=${id}`).then(r=>r.text()),/Client approved headline/)
 const emptyHTML=await fetch(`${server}/about/?_site=${id}`).then(r=>r.text())
 assert.match(emptyHTML,/<title>Founding client<\/title>/);assert.match(emptyHTML,/data-primo-baseline/)
 console.log('PASS editor publishes through packaged CMS browser compiler, including empty-page metadata')
 await clientContext.close()
 console.log('PASS second user edits content through the browser editor and persists it')
 console.log('PASS second user invitation link, password setup, login and content edit')
 await ok(['publish','--server',server,'--site',id,'--dir',site,'--token',client.token,'--json'])
 publicText=await fetch(`${server}/?_site=${id}`).then(r=>r.text());assert.match(publicText,/Client approved headline/);assert.match(publicText,/Client section 4/)
 assert.ok(publicText.indexOf('Charlie')<publicText.indexOf('Alpha')&&publicText.indexOf('Alpha')<publicText.indexOf('Bravo'))
 assert.ok(publicText.indexOf('Second nested link')<publicText.indexOf('First nested link'))
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>document.addEventListener('readystatechange',()=>{if(document.readyState==='interactive')window.originalHeadings=[...document.querySelectorAll('h1')]}))
 await page.goto(`${server}/?_site=${id}`)
 assert.deepEqual(await page.locator('[data-testid=client-items]').first().locator(':scope > li > span').allTextContents(),['Charlie','Alpha','Bravo'])
 assert.deepEqual(await page.locator('[data-testid=client-items]').first().locator(':scope > li:nth-child(2) > ul > li').allTextContents(),['Second nested link','First nested link'])
 await page.locator('button').first().click();await page.waitForFunction(()=>document.querySelector('button')?.textContent==='1')
 assert.equal(await page.locator('h1').count(),5)
 const retained=await page.evaluate(()=>window.originalHeadings.filter((node,i)=>node===document.querySelectorAll('h1')[i]&&node.isConnected).length)
 assert.equal(retained,5,'Every original SSR heading must survive hydration')
 console.log(`OBSERVED CLI publication retained ${retained}/5 SSR headings`)
 assert.deepEqual(errors,[])
 // Published-site responsive checks use disposable contexts on this same engine.
 for (const width of [390, 768, 1440]) {
  const responsive = await browser.newContext({viewport:{width,height:844}})
  const mobile = await responsive.newPage();const errors=[];mobile.on('pageerror',error=>errors.push(error.message))
  await mobile.goto(`${server}/?_site=${id}`);await mobile.locator('button').first().click();await mobile.waitForFunction(()=>document.querySelector('button')?.textContent==='1')
  assert.equal(await mobile.locator('h1').count(),5);assert.deepEqual(await mobile.locator('[data-testid=client-items]').first().locator(':scope > li > span').allTextContents(),['Charlie','Alpha','Bravo']);assert.deepEqual(errors,[])
  console.log(`PASS published responsive rendering and interaction at ${width}px`);await responsive.close()
 }
 const editorContext=await browser.newContext()
 const editorPage=await editorContext.newPage()
 await editorPage.addInitScript(({token,record})=>localStorage.setItem('pocketbase_auth',JSON.stringify({token,record})),auth)
 await editorPage.goto(`${server}/admin/sites/${id}`)
 await editorPage.waitForFunction(()=>{const frames=[...document.querySelectorAll('main iframe[title=block]')];return frames.length===5&&frames.every(frame=>frame.contentDocument?.querySelector('h1'))},{},{timeout:90000})
 console.log('PASS local editor resolves and renders all five block iframes')
 await editorContext.close()
 const repull=path.join(ws.root,'handoff-copy');await ok(['pull',server,repull,'--token',auth.token])
 const repulledSlug=(await fs.readdir(path.join(repull,'sites')))[0]
 const yaml=await fs.readFile(path.join(repull,'sites',repulledSlug,'pages/index.yaml'),'utf8')
 assert.match(yaml,/Client approved headline/);assert.match(yaml,/Client section 4/)
 const finalHome=yamlParser.load(yaml)
 assert.deepEqual(finalHome.sections.map(section=>section.content.heading),['Client approved headline','Client section 1','Client section 2','Client section 3','Client section 4'])
 assert.deepEqual(finalHome.sections.map(section=>section._id),initialHome.sections.map(section=>section._id))
 assert.deepEqual(finalHome.sections[0].content.items.map(item=>item.name),['Charlie','Alpha','Bravo'])
 assert.deepEqual(finalHome.sections[0].content.items[1].details.links.map(link=>link.label),['Second nested link','First nested link'])
 console.log('PASS editor reorder survives browser/CLI republication, public rendering and final pull')
 assert.equal((await api(`/api/collections/pages/records?filter=${filter}`)).items.length,3)
 assert.equal((await api(`/api/collections/site_symbols/records/${block.id}`)).html,'<p>Contact us</p>')
 console.log('PASS second user republication, interactive browser render and no content loss in final pull')
 // Enforce the handoff source-permission boundary using disposable records.
 const permission=await fetch(`${server}/api/collections/site_symbols/records/${block.id}`,{method:'PATCH',headers:{Authorization:`Bearer ${client.token}`,'Content-Type':'application/json'},body:JSON.stringify({html:'<p>Editor changed code</p>'})})
 assert.equal(permission.status,403,await permission.text())
 assert.equal((await api(`/api/collections/site_symbols/records/${block.id}`)).html,'<p>Contact us</p>')
 const forbiddenType=await fetch(`${server}/api/collections/page_types/records`,{method:'POST',headers:{Authorization:`Bearer ${client.token}`,'Content-Type':'application/json'},body:JSON.stringify({site:id,name:'Forbidden client type'})})
 assert.equal(forbiddenType.status,403,await forbiddenType.text())
 const parentCycle=await fetch(`${server}/api/collections/page_section_entries/records/${entry.id}`,{method:'PATCH',headers:{Authorization:`Bearer ${client.token}`,'Content-Type':'application/json'},body:JSON.stringify({parent:entry.id})})
 assert.equal(parentCycle.status,403,await parentCycle.text())
 assert.equal((await api(`/api/collections/page_section_entries/records/${entry.id}`)).value,'Client approved headline')
 console.log('PASS server denies editor block-code, page-type and parent-cycle changes; source and content remain intact')
 assert.equal(retained,5,'CLI publication compiler dependency replaced server-rendered nodes')
})
