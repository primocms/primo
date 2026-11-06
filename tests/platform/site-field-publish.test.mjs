import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import net from 'node:net'
import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { make_workspace, run_cli } from './helpers/batched-cli.mjs'

test('real CMS: key/ID publication, export/import round trip, and unresolved references preserve source and live content', {
 skip: !process.env.PRIMO_TEST_CMS_BINARY, timeout: 90000
}, async (t) => {
 const workspace = await make_workspace()
 const reservation = net.createServer()
 await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
 const port = reservation.address().port
 await new Promise(resolve => reservation.close(resolve))
 const server = `http://127.0.0.1:${port}`
 let logs = ''
 const cms = spawn(path.resolve(process.env.PRIMO_TEST_CMS_BINARY), ['serve', '--http', `127.0.0.1:${port}`, '--dir', path.join(workspace.root, 'pb_data')], {
  env: { ...process.env, PRIMO_DEV_MODE: '1', PRIMO_AUTHOR_MODE: 'both', PRIMO_ENABLE_USAGE_STATS: 'false' }, stdio: ['ignore', 'pipe', 'pipe']
 })
 cms.stdout.on('data', data => { logs += data })
 cms.stderr.on('data', data => { logs += data })
 t.after(async () => {
  if (cms.exitCode === null) {
   const stopped = new Promise(resolve => cms.once('close', resolve))
   cms.kill('SIGTERM')
   await stopped
  }
  await workspace.cleanup()
 })
 let ready = false
 for (let i=0; i<100; i++) {
  try { if ((await fetch(`${server}/api/health`)).ok) { ready = true; break } } catch {}
  if (cms.exitCode !== null) break
  await delay(100)
 }
 assert(ready, logs)
 const id = 'sharedfieldtst1'
 const dir = path.join(workspace.work,'sites/demo')
 const files = {
  'site.yaml': `name: Demo\nsite_id: ${id}\nserver: ${server}\n`,
  'site/fields.yaml': `- name: nav_links
  type: repeater
  subfields:
    - name: link
      type: link
- name: footer_groups
  type: repeater
  subfields:
    - name: title
      type: text
    - name: links
      type: repeater
      subfields:
        - name: link
          type: link
- name: notice
  type: text
- name: count
  type: number
- name: enabled
  type: switch
`,
  'site/content.yaml': `nav_links:
  - link: { url: 'https://example.com/about', label: About }
footer_groups:
  - title: Explore
    links:
      - link: { url: 'https://example.com/help', label: Help }
notice: Shared copyright
count: 0
enabled: false
`,
  'blocks/shared/config.yaml': 'name: Shared\n',
  'blocks/shared/component.svelte': '<nav>{#each navigation as item}<a href={item.link.url}>{item.link.label}</a>{/each}</nav>{#each groups as group}<h2>{group.title}</h2>{#each group.links as item}<a href={item.link.url}>{item.link.label}</a>{/each}{/each}<p>{notice}:{count}:{enabled}</p><script>let mounted = true;</script>',
  'blocks/shared/fields.yaml': [['navigation','nav_links'],['groups','footer_groups'],['notice','notice'],['count','count'],['enabled','enabled']].map(([key,source]) => `- name: ${key}\n  type: site-field\n  config: { field: ${source} }\n`).join(''),
  'blocks/shared/content.yaml': '{}\n',
  'page-types/default/config.yaml': 'name: Default\nallowed_blocks: [shared]\n',
  'page-types/default/layout.yaml': 'header:\n  - block: shared\nfooter:\n  - block: shared\n',
  'pages/index.yaml': 'name: Home\npage_type: Default\nsections: []\n'
 }
 for (const [file, value] of Object.entries(files)) {
  await fs.mkdir(path.dirname(path.join(dir,file)),{recursive:true})
  await fs.writeFile(path.join(dir,file),value)
 }
 const cli = args => run_cli(args, { cwd: workspace.work, home: workspace.home, timeout_ms: 30000 })
 let result = await cli(['push','--dir',dir,'--json'])
 assert.equal(result.code,0,result.output)
 const {token} = await fetch(`${server}/api/primo/dev-auth`,{method:'POST'}).then(r=>r.json())
 const auth = {Authorization:token}
 const records = async (collection,filter) => {
  const response = await fetch(`${server}/api/collections/${collection}/records?${new URLSearchParams({filter,perPage:'500',sort:'id'})}`,{headers:auth})
  assert.equal(response.status,200,await response.clone().text())
  return (await response.json()).items
 }
 const fields = () => records('site_symbol_fields',`symbol.site="${id}"`)
 const siteFields = () => records('site_fields',`site="${id}"`)
 const entries = () => records('site_entries',`field.site="${id}"`)
 const patchReference = async (field,reference) => {
  const response = await fetch(`${server}/api/collections/site_symbol_fields/records/${field.id}`,{method:'PATCH',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({config:{...field.config,field:reference}})})
  assert.equal(response.status,200,await response.text())
 }
 // Reproduce legacy stored keys in a disposable database. No production access.
 const roots = (await siteFields()).filter(field=>!field.parent)
 for (const field of await fields()) await patchReference(field,roots.find(root=>root.id===field.config.field).key)
 const stripMetadata = records => records.map(({created,updated,collectionId,collectionName,expand,...record})=>record)
 const snapshot = async () => ({fields:stripMetadata(await fields()),siteFields:stripMetadata(await siteFields()),entries:stripMetadata(await entries())})
 const before = await snapshot()
 const publish = () => cli(['publish',server,'--site',id,'--token',token,'--json'])
 const publicHTML = () => fetch(`${server}/?_site=${id}`).then(r=>r.text())
 const checkHTML = html => {
  assert.equal([...html.matchAll(/href="https:\/\/example.com\/about"[^>]*>About<\/a>/g)].length,2)
  assert.equal([...html.matchAll(/Explore/g)].length,4) // SSR plus hydration props in each shared zone.
  assert.match(html,/href="https:\/\/example.com\/help"[^>]*>Help<\/a>/)
  assert.match(html,/Shared copyright:0:false/)
 }
 result = await publish()
 assert.equal(result.code,0,result.output)
 checkHTML(await publicHTML())
 assert.deepEqual(await snapshot(),before,'publication must not rewrite IDs, config references or entries')
 // Pull writes portable keys; reimport the export then publish its ID references.
 result = await cli(['pull',server,workspace.work,'--token',token])
 assert.equal(result.code,0,result.output)
 const exported = yaml.load(await fs.readFile(path.join(dir,'blocks/shared/fields.yaml'),'utf8'))
 assert.equal(exported.find(field=>field.name==='navigation').config.field,'nav_links')
 result = await cli(['push','--dir',dir,'--token',token,'--json'])
 assert.equal(result.code,0,result.output)
 const afterImport = await snapshot()
 assert.deepEqual(afterImport.siteFields,before.siteFields)
 const entryValues = entries => entries.map(({field,value,locale,index})=>JSON.stringify({field,value,locale,index})).sort()
 assert.deepEqual(entryValues(afterImport.entries),entryValues(before.entries))
 assert.deepEqual(afterImport.fields.map(field=>field.id),before.fields.map(field=>field.id))
 result = await publish()
 assert.equal(result.code,0,result.output)
 checkHTML(await publicHTML())
 assert.deepEqual(await snapshot(),afterImport)
 const workingHTML = await publicHTML()
 const broken = (await fields()).find(field=>field.key==='navigation')
 await patchReference(broken,'missing-nav')
 result = await publish()
 assert.equal(result.code,1,result.output)
 const receipt = JSON.parse(result.stdout).results[0].publish
 assert.equal(receipt.state,'failed')
 assert.match(receipt.error,/missing-nav.*Shared.*navigation.*config.field.*site\/fields.yaml/)
 assert.equal(await publicHTML(),workingHTML,'failed publication must retain the last live HTML')
})
