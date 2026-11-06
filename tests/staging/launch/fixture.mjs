import fs from 'node:fs/promises'
import {createReadStream} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {options,loadConfig,placeholder,invariant,privateReport} from './lib.mjs'
export function fixtureIssues(c) {
 const missing=[]
 for(const key of ['sourcePrimoVersion','sourcePocketBaseVersion','backupPath'])if(placeholder(c[key]))missing.push(key)
 if(!/^[a-f0-9]{64}$/.test(c.sha256 || ''))missing.push('sha256: owner checksum required')
 if(c.ownerVerifiedSanitized!==true)missing.push('ownerVerifiedSanitized')
 if(c.ownerVerifiedConsistentOfflineBackup!==true)missing.push('ownerVerifiedConsistentOfflineBackup')
 for(const key of ['sites','pages','uploads'])if(!Number.isInteger(c.expected?.[key]) || c.expected[key]<0)missing.push('expected.'+key)
 return missing
}
export async function inventory(c) {
 const root=path.resolve(c.baseDirectory,c.backupPath),files=[],directories=[]
 const output=path.resolve(c.baseDirectory,c.outputDirectory || '.runs')
 invariant(output!==root && !output.startsWith(root+path.sep),'Evidence output must be outside the fixture')
 async function walk(p,relative='') {
  const st=await fs.lstat(p)
  invariant(!st.isSymbolicLink(),'Fixture symlinks are not accepted')
  if(st.isDirectory()) {
   directories.push({path:p,mtime:st.mtimeMs})
   for(const name of (await fs.readdir(p)).sort())await walk(path.join(p,name),relative?relative+'/'+name:name)
  } else {
   invariant(st.isFile(),'Fixture must contain only regular files/directories')
   invariant(!/-wal$|-shm$/.test(p),'Live SQLite WAL/SHM found; supply an offline or native backup')
   invariant(files.length<100000 && st.size<=10*1024**3,'Fixture exceeds inventory bounds')
   const h=createHash('sha256');for await(const chunk of createReadStream(p))h.update(chunk)
   const after=await fs.stat(p);invariant(after.size===st.size && after.mtimeMs===st.mtimeMs,'Fixture changed while hashing')
   files.push({path:relative || path.basename(p),bytes:st.size,sha256:h.digest('hex')})
  }
 }
 await walk(root)
 for(const d of directories)invariant((await fs.stat(d.path)).mtimeMs===d.mtime,'Fixture directory changed during inventory')
 const directory=(await fs.stat(root)).isDirectory()
 if(directory)invariant(files.some(f=>f.path==='data.db'),'PocketBase data.db missing from directory snapshot')
 invariant(files.length>0,'Empty fixture')
 files.sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)))
 // Directory checksum is SHA256 of sorted UTF-8 path, NUL, file hash, LF records.
 const hash=directory ? createHash('sha256').update(files.map(f=>f.path+'\0'+f.sha256+'\n').join('')).digest('hex') : files[0].sha256
 invariant(hash===c.sha256,'Fixture checksum does not match the owner-provided checksum')
 return {kind:'fixture-inventory',status:'PASS_INVENTORY_ONLY',sourcePrimoVersion:c.sourcePrimoVersion,sourcePocketBaseVersion:c.sourcePocketBaseVersion,ownerAttestations:{sanitized:true,consistentOfflineBackup:true},format:directory?'directory':'archive-or-file-not-extracted',sha256:hash,files,expected:c.expected,limitations:['No extraction, migration, database query or write was performed.','Sanitation and database consistency are owner attestations, not independently proven by hashing.','Expected record counts/values must be checked after restoring a disposable copy.']}
}
async function main() {
 const o=options();if(o.help){console.log('node fixture.mjs --config fixture.local.json [--run]\nDefault: checklist validation. --run: read-only checksum inventory; never extracts or changes databases.');return}
 const c=await loadConfig(o.config),issues=fixtureIssues(c)
 if(!o.run || issues.length){console.log(JSON.stringify({kind:'fixture',status:issues.length?'BLOCKED_MISSING_FIXTURE':'READY_NOT_RUN',missing:issues,networkRequests:0},null,2));process.exitCode=issues.length?2:0;return}
 c.outputDirectory ||= '.runs'
 const result=await inventory(c),file=await privateReport(c,'fixture',result)
 console.log(JSON.stringify({status:result.status,files:result.files.length,evidence:file}))
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Fixture inventory failed: verify path, consistency, sanitation and checksum; no data was changed.');process.exitCode=2})
