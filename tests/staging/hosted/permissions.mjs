import {context,fs,path,invariant} from './lib.mjs'
const c=await context(),actors=JSON.parse(await fs.readFile(path.join(c.run,'private/actors.json'),'utf8')),a=actors[0],other=actors[1]
const admin=await c.login(c.credentials.adminEmail,c.credentials.adminPassword,true),editor=await c.login(a.email,a.password)
const section=await c.ok('/api/collections/page_sections/records/'+a.sectionId,{token:admin.token})
const checks=[]
async function denied(collection,id,key,value,label) {
 const route='/api/collections/'+collection+'/records/'+id
 const original=await c.ok(route,{token:admin.token})
 const response=await c.api(route,{method:'PATCH',token:editor.token,body:{[key]:value}})
 if(response.ok) {
  const current=await c.ok(route,{token:admin.token})
  invariant(JSON.stringify(current[key])===JSON.stringify(value),'Unexpected concurrent change during permission recovery')
  await c.patch(collection,id,{[key]:original[key]},admin.token)
 }
 invariant([403,404].includes(response.status),'Permission boundary failed: '+label+' HTTP '+response.status)
 const after=await c.ok(route,{token:admin.token})
 invariant(JSON.stringify(after[key])===JSON.stringify(original[key]),'Denied operation changed stored data')
 checks.push({check:label,status:response.status,unchanged:true})
}
const symbol=await c.ok('/api/collections/site_symbols/records/'+section.symbol,{token:admin.token})
await denied('site_symbols',symbol.id,'html',symbol.html+'\n<!-- QA denied source mutation -->','content editor cannot change block source')
await denied('site_symbol_fields',a.fieldId,'label','QA denied schema change','content editor cannot change field schema')
await denied('users',a.userId,'serverRole','developer','content editor cannot grant a server-wide role')
const otherSection=await c.ok('/api/collections/page_sections/records/'+other.sectionId,{token:admin.token})
const otherField=(await c.ok('/api/collections/site_symbol_fields/records?filter='+encodeURIComponent('symbol="'+otherSection.symbol+'" && key="heading"'),{token:admin.token})).items[0]
const otherHeading=(await c.ok('/api/collections/page_section_entries/records?filter='+encodeURIComponent('section="'+other.sectionId+'" && field="'+otherField.id+'"'),{token:admin.token})).items[0]
await denied('page_section_entries',otherHeading.id,'value','QA denied cross-tenant write','content editor cannot write another agency')
// The foreign canary can legitimately advance during the soak. Read-only denial
// is independently asserted by every workload cycle; this probe never writes it.
const hidden=await c.api('/api/collections/page_section_entries/records/'+other.entryId,{token:editor.token})
invariant([403,404].includes(hidden.status),'Foreign entry read was exposed')
await c.save('hosted-permissions.json',{status:'PASS_HOSTED_PERMISSION_BOUNDARIES',checks,foreignReadStatus:hidden.status,productionChanged:false})
console.log('PASS hosted source/schema/role restrictions and cross-tenant denial')
