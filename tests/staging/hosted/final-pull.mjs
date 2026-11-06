import {context,fs,path,invariant} from './lib.mjs'
const c=await context(),a=JSON.parse(await fs.readFile(path.join(c.run,'private/actors.json'),'utf8'))[0],auth=await c.login(a.email,a.password),yaml=c.requireCLI('js-yaml')
const list=collection=>c.ok('/api/collections/'+collection+'/records?perPage=500',{token:auth.token}).then(x=>x.items)
const before=await list('page_section_entries'),fields=await list('site_symbol_fields'),sections=await list('page_sections'),pages=await list('pages')
const output=path.join(c.run,'client-final-copy');invariant(!await fs.access(output).then(()=>true,()=>false),'Refusing to replace an existing final client copy')
await c.command(['pull',c.state.cmsOrigin,output,'--token',auth.token])
const sites=await fs.readdir(path.join(output,'sites'));invariant(sites.length===1,'Final content editor pull exposed another site')
const local=path.join(output,'sites',sites[0]),page=yaml.load(await fs.readFile(path.join(local,'pages/index.yaml'),'utf8')),manifest=JSON.parse(await fs.readFile(path.join(local,'.primo/manifest.json'),'utf8'))
invariant(pages.length===1 && page._id===pages[0].id && page.sections.length===5,'Final pulled page identity/count differs')
const canonical=x=>JSON.stringify(x,(_,v)=>v && !Array.isArray(v) && typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)
for(const section of page.sections){
 invariant(sections.some(s=>s.id===section._id && s.page===page._id),'Final section identity/binding differs')
 const own=before.filter(e=>e.section===section._id),field=key=>fields.find(f=>f.key===key),leaf=(key,parent='')=>own.find(e=>e.field===field(key).id && e.parent===parent)?.value
 const expected=Object.fromEntries(['environment','heading','qa_scratch'].map(k=>[k,leaf(k)]))
 expected.items=own.filter(e=>e.field===field('items').id && !e.parent).sort((a,b)=>a.index-b.index).map(root=>{
  const item={name:leaf('name',root.id)},links=own.filter(e=>e.field===field('links').id && e.parent===root.id).sort((a,b)=>a.index-b.index).map(link=>({label:leaf('label',link.id)}));if(links.length)item.links=links;return item
 })
 invariant(canonical(section.content)===canonical(expected),'Final pulled nested content or order differs')
}
const fieldIds=Object.values(manifest.block_fields).flatMap(x=>Object.values(x));invariant(fieldIds.length===fields.length && fields.every(f=>fieldIds.includes(f.id)),'Exported field identities differ')
const after=await list('page_section_entries');invariant(canonical(before.sort((a,b)=>a.id.localeCompare(b.id)))===canonical(after.sort((a,b)=>a.id.localeCompare(b.id))),'Read-only final pull changed server content')
await c.save('final-client-pull.json',{status:'PASS_FINAL_SCOPED_CLIENT_PULL',siteCount:sites.length,pages:1,sections:5,fields:fields.length,entries:before.length,nestedValuesAndOrderMatchServer:true,pageSectionAndFieldIdsRetained:true,authoritativeRecordsUnchanged:true,productionChanged:false})
console.log('PASS final exact-CLI scoped client pull: nested values/order and all authoritative identities retained')
