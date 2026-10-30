import {createReadStream} from 'node:fs'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {candidate,invariant} from './lib.mjs'
export async function attest(file,target) {
 const expected=candidate.cms.nativeSha256ByTarget[target]
 invariant(!!expected,'Unknown native target')
 const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk)
 const actual=hash.digest('hex');invariant(actual===expected,'Native executable does not match frozen RC.7')
 return {status:'PASS_BINARY_BYTES_ONLY',target,sha256:actual,sourceCommit:candidate.cms.sourceCommit,nativeRunId:candidate.cms.runId,note:'No executable was started. Operator must also identify this file as the running staging service binary.'}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 if(process.argv.includes('--help'))console.log('node attest-binary.mjs /path/to/running-service-binary linux_amd64|linux_arm64|darwin_amd64|darwin_arm64|windows_amd64\nRead-only hash check; does not run the binary or deploy anything.')
 else attest(process.argv[2],process.argv[3]).then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error('Binary attestation failed; check target and original native bytes.');process.exitCode=1})
}
