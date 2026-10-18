import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {setTimeout as delay} from 'node:timers/promises'
import {webkit} from '@playwright/test'

// Playwright 1.63's Linux libsoup 3.6.5 can corrupt its network process while
// navigation cancels requests (microsoft/playwright#42803). Verify both the
// fixed bundled bytes and the library actually mapped by a real network process.
assert.equal(process.platform,'linux')
const require=createRequire(import.meta.url)
const report={status:'FAIL',sourceCommit:process.env.PRIMO_CANDIDATE_SHA,testRunner:require('@playwright/test/package.json').version,libraries:[],networkProcesses:[]}
let browser,server
try {
 assert.ok(report.sourceCommit,'Exact source provenance is required')
 assert.equal(report.testRunner,'1.64.1')
 assert.ok(!process.env.LD_PRELOAD,'Qualification must use the bundled fixed library')
 const root=path.dirname(webkit.executablePath()),files=await fs.readdir(root,{recursive:true}),verified=new Map()
 for(const file of files.filter(file=>/(?:^|\/)libsoup-3\.0\.so(?:\.\d+)*$/.test(file))){
  const real=await fs.realpath(path.join(root,file));if(verified.has(real))continue
  const bytes=await fs.readFile(real),version=bytes.toString('latin1').match(/libsoup\/(\d+\.\d+\.\d+)/)?.[1];assert.ok(version,'Bundled libsoup version must be observable')
  const [major,minor,patch]=version.split('.').map(Number);assert.ok(major>3||(major===3&&(minor>6||(minor===6&&patch>=6))),'Bundled libsoup must include the 3.6.6 use-after-free fix: '+version)
  const row={file:path.relative(root,real),version,sha256:createHash('sha256').update(bytes).digest('hex')};verified.set(real,row);report.libraries.push(row)
 }
 assert.ok(verified.size,'Bundled libsoup library was not found')
 server=http.createServer((request,response)=>{response.writeHead(200,{'Content-Type':'text/html'});response.end('<!doctype html><title>Disposable network runtime probe</title><p>Ready</p>')})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 browser=await webkit.launch({headless:true});report.browserVersion=browser.version()
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port,{timeout:15000})
 for(let attempt=0;attempt<20&&!report.networkProcesses.length;attempt++){
  for(const pid of (await fs.readdir('/proc')).filter(pid=>/^\d+$/.test(pid))){
   let command,maps;try{command=(await fs.readFile('/proc/'+pid+'/cmdline')).toString();if(!command.includes('NetworkProcess'))continue;maps=await fs.readFile('/proc/'+pid+'/maps','utf8')}catch{continue}
   const loaded=[...new Set(maps.split('\n').filter(line=>line.includes('/libsoup-3.0.so')).map(line=>line.slice(line.indexOf('/'))))]
   if(!loaded.length)continue
   const libraries=[]
   for(const file of loaded){const real=await fs.realpath(file);assert.ok(verified.has(real),'Network process mapped an unverified libsoup: '+file);libraries.push(verified.get(real))}
   report.networkProcesses.push({pid:Number(pid),libraries})
  }
  if(!report.networkProcesses.length)await delay(50)
 }
 assert.ok(report.networkProcesses.length,'Could not verify a real WebKit network-process mapping')
 report.status='PASS_FIXED_WEBKIT_NETWORK_RUNTIME';report.loopbackOnly=true
 console.log(JSON.stringify(report,null,2))
} catch(error){report.failure=error.message;throw error}
finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}await fs.writeFile('webkit-runtime.json',JSON.stringify(report,null,2)+'\n')}
