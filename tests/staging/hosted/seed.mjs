import {randomBytes} from 'node:crypto'
import {context,mcpSession,fs,path,delay,invariant} from './lib.mjs'
const c=await context(),{run,state,evidence}=c
if(await fs.access(path.join(run,'evidence/seed.json')).then(()=>true,()=>false)){console.log('Already seeded; existing private configuration and test data were preserved.');process.exit(0)}
const pass=()=>randomBytes(24).toString('base64url')+'Aa1!'
const admin=await c.login(c.credentials.adminEmail,c.credentials.adminPassword,true)
const builder=await c.login(c.credentials.builderEmail,c.credentials.builderPassword)
const info=await c.ok('/api/primo/info')
invariant(info.version==='v3.3.2-rc.7' && info.dev_mode===false && info.site_count<=10,'Only this disposable RC.7 production-mode test instance may be seeded')
invariant((await c.api('/api/primo/dev-auth',{method:'POST'})).status===404,'Dev authentication must remain disabled')
const settings=await c.ok('/api/settings',{token:admin.token})
invariant(settings.rateLimits.enabled && settings.backups.cron,'Production limiter and backups must remain enabled')
if(state.mailSmtpHost)await c.ok('/api/settings',{method:'PATCH',token:admin.token,body:{smtp:{enabled:true,host:state.mailSmtpHost,port:1025,tls:false,username:'',password:'',authMethod:'PLAIN'},meta:{...settings.meta,appURL:state.cmsOrigin,senderName:'Disposable Primo RC.7 QA',senderAddress:'noreply@primo-qa.invalid'}}})
evidence.checks.push('Exact archives and every installed CLI/MCP file verified; RC.7 production validation, throttling and backup schedule enabled; dev-auth HTTP 404')
if(!await fs.access(path.join(run,'workspace/server.yaml')).then(()=>true,()=>false))await c.command(['init','--no-mcp'])
const mcp=await mcpSession(c),yaml=c.requireCLI('js-yaml')
const groups=await c.ok('/api/collections/site_groups/records?filter='+encodeURIComponent('name="RC.7 disposable agencies"'),{token:builder.token})
const group=groups.items[0] ?? await c.create('site_groups',{name:'RC.7 disposable agencies',index:0},builder.token)
const actors=await fs.readFile(path.join(run,'private/actors.json'),'utf8').then(JSON.parse,()=>[])
const existing=(await c.ok('/api/collections/sites/records?perPage=200',{token:admin.token})).items
invariant(existing.every(s=>/^PRIMO QA agency-(0[1-9]|10)$/.test(s.name) && s.group===group.id),'Unexpected records in the disposable seed project')
const fixtures=path.resolve(import.meta.dirname,'../launch/fixtures')
try {
 await mcp.call('list_docs');await mcp.call('get_docs',{section:'recommended-defaults'})
 const fields=yaml.load(await fs.readFile(path.join(fixtures,'qa-fields.yaml'),'utf8'))
 const scaffold=await mcp.call('scaffold_block',{name:'qa-probe',fields:[{name:'heading',type:'text'}]})
 const type=await mcp.call('scaffold_page_type',{name:'default',allowed_blocks:['qa-probe'],fields:[]})
 for(let i=1;i<=10;i++) {
  const name='agency-'+String(i).padStart(2,'0')
  if(actors.some(a=>a.name===name))continue
  const site=existing.find(s=>s.name==='PRIMO QA '+name) ?? await c.create('sites',{name:'PRIMO QA '+name,host:i===1?new URL(state.cmsOrigin).hostname:name+'.primo-qa.invalid',group:group.id},builder.token)
  if(!await fs.access(path.join(run,'workspace/sites',name,'site.yaml')).then(()=>true,()=>false))await c.command(['new',name,'--skip-dev'])
  const local=path.join(run,'workspace/sites',name)
  for(const dir of ['blocks','page-types','pages','site'])await fs.rm(path.join(local,dir),{recursive:true,force:true})
  for(const file of [...scaffold.files,...type.files]) {
   const destination=path.join(local,file.path);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,file.contents)
  }
  for(const [source,destination] of [['qa-block.svelte','blocks/qa-probe/component.svelte'],['qa-fields.yaml','blocks/qa-probe/fields.yaml'],['qa-content.example.yaml','blocks/qa-probe/content.yaml'],['qa-page.example.yaml','pages/index.yaml']]) {
   const file=path.join(local,destination);await fs.mkdir(path.dirname(file),{recursive:true})
   const body=(await fs.readFile(path.join(fixtures,source),'utf8')).replaceAll('REPLACE_WITH_UNIQUE_DISPOSABLE_ENVIRONMENT',state.environmentMarker).replaceAll('QA scratch agency-01','QA scratch '+name)
   await fs.writeFile(file,body)
  }
  await fs.mkdir(path.join(local,'site'),{recursive:true});await fs.writeFile(path.join(local,'site/head.svelte'),'<title>Disposable RC.7 handoff QA</title>')
  await fs.writeFile(path.join(local,'site.yaml'),yaml.dump({name:'PRIMO QA '+name,site_id:site.id,server:state.cmsOrigin,host:site.host,group:group.id}))
  const block=await mcp.call('validate_block',{site_path:local,name:'qa-probe'}),page=await mcp.call('validate_page',{site_path:local,page_path:'pages/index.yaml'})
  invariant(block.ok && page.ok,'Packaged MCP rejected the complete fixture')
  const empty=await c.ok('/api/collections/pages/records?filter='+encodeURIComponent('site="'+site.id+'"'),{token:admin.token})
  invariant(empty.totalItems===0,'Initial seed overwrite is allowed only for an empty synthetic site')
  await c.command(['push','--dir',local,'--server',state.cmsOrigin,'--token',builder.token,'--force','--yes','--json'])
  await c.command(['publish','--server',state.cmsOrigin,'--site',site.id,'--token',builder.token,'--json'])
  const pages=(await c.ok('/api/collections/pages/records?perPage=200&filter='+encodeURIComponent('site="'+site.id+'"'),{token:admin.token})).items
  const home=pages.find(p=>!p.slug);invariant(home,'Imported fixture has no home page')
  const sections=(await c.ok('/api/collections/page_sections/records?perPage=200&sort=index&filter='+encodeURIComponent('page="'+home.id+'"'),{token:admin.token})).items
  invariant(sections.length===5,'Expected five imported block instances')
  const section=sections[0]
  const field=(await c.ok('/api/collections/site_symbol_fields/records?perPage=200&filter='+encodeURIComponent('symbol="'+section.symbol+'" && key="qa_scratch"'),{token:admin.token})).items[0]
  const entry=(await c.ok('/api/collections/page_section_entries/records?perPage=200&filter='+encodeURIComponent('section="'+section.id+'" && field="'+field.id+'"'),{token:admin.token})).items[0]
  invariant(entry?.value==='QA scratch '+name,'Imported scratch value mismatch')
  const password=pass(),email=name+'@primo-qa.invalid';c.secrets.add(password)
  const user=await c.create('users',{email,password,passwordConfirm:password,name,serverRole:'',verified:true,invite:i===1?'pending':''},admin.token)
  await c.create('site_role_assignments',{site:site.id,user:user.id,role:'editor'},admin.token)
  actors.push({name,email,password,userId:user.id,siteId:site.id,pageId:home.id,sectionId:section.id,fieldId:field.id,entryId:entry.id,expectedOriginalValue:entry.value,localDirectory:local})
  await c.save('actors.json',actors,true)
  console.log('Prepared and published synthetic '+name)
 }
 const config=JSON.parse(await fs.readFile(path.resolve(import.meta.dirname,'../launch/staging.example.json'),'utf8'))
 Object.assign(config,{environmentId:state.environmentMarker,disposable:true,cmsOrigin:state.cmsOrigin,cmsProbePath:'/?_site='+actors[0].siteId,publicPages:[{url:state.cmsOrigin+'/',headings:Array.from({length:5},(_,i)=>'QA section '+i)}],outputDirectory:'../evidence/runs'})
 config.soak={...config.soak,loginIntervalMs:1700,exclusiveScratchRecords:true,criteriaConfirmed:false}
 config.actors=actors.map((a,i)=>{const n=String(i+1).padStart(2,'0');return {name:a.name,emailEnv:'PRIMO_QA_EMAIL_'+n,passwordEnv:'PRIMO_QA_PASSWORD_'+n,...Object.fromEntries(['userId','siteId','pageId','sectionId','fieldId','entryId','expectedOriginalValue'].map(k=>[k,a[k]]))}})
 await c.save('staging.local.json',config,true)
 const env=actors.map((a,i)=>{const n=String(i+1).padStart(2,'0');return 'PRIMO_QA_EMAIL_'+n+'='+a.email+'\nPRIMO_QA_PASSWORD_'+n+'='+a.password}).join('\n')+'\n'
 await fs.writeFile(path.join(run,'private/actors.local.env'),env,{mode:0o600})
 const publicResponse=await c.api('/')
 invariant(publicResponse.status===200 && publicResponse.text.includes('data-primo-launch-fixture="'+state.environmentMarker+'"'),'Initial publication not served through the real ingress')
 evidence.checks.push('Actual built CLI init/new/push/publish and packaged MCP scaffolding/validation created ten synthetic sites with five block instances and nested repeaters each')
 evidence.checks.push('Ten distinct site-scoped editors and dedicated scratch records; only the first site uses the provider public hostname; other sites use explicit preview routes')
 evidence.status='PASS_HOSTED_SEED';evidence.finishedUtc=new Date().toISOString()
 await c.save('seed.json',evidence)
}finally{await mcp.close()}
