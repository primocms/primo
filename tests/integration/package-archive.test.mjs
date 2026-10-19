import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {archiveFiles,archiveFile} from '../staging/rc8/archive.mjs'

test('exact-package verification can list and extract a real archive under drive-like and spaced paths',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'primo-archive-'))
 t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const directory=path.join(root,process.platform==='win32'?'local archive directory':'D: local archive directory')
 await fs.mkdir(directory)
 const archive=path.join(directory,'primo-cli-0.3.0-rc.2.tgz')
 await fs.copyFile(new URL('../../release/vendor/primo-cli-0.3.0-rc.2.tgz',import.meta.url),archive)
 const previousDirectory=process.cwd()
 try {
  process.chdir(root)
  // On POSIX start the argument with D: as a Windows absolute path would.
  // Passing this directly to GNU tar would request a remote host named D.
  const input=process.platform==='win32'?archive:path.relative(root,archive)
  assert.ok(archiveFiles(input).includes('package/dist/bootstrap.js'))
  assert.deepEqual(archiveFile(input,'package/dist/bootstrap.js'),await fs.readFile(new URL('../../node_modules/primo-cli/dist/bootstrap.js',import.meta.url)))
 }finally{process.chdir(previousDirectory)}
})
