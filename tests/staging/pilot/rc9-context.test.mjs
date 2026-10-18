import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validateActor} from './rc9-context.mjs'
const actor={origin:'https://rc8-pilot-cms-pilot-rc8.up.railway.app',sourceCommit:'15085e33013584ba47c581052997e93e7131a37d',nativeSha256:'225ee7e19272d33604ec26eac239dfa11ae2072b1b85500dc59847a66866d303',environmentId:'e9f6f82b-aac0-4612-93ae-07b4a896635e',siteId:'aaaaaaaaaaaaaaa',sectionId:'bbbbbbbbbbbbbbb',headingId:'ccccccccccccccc',userId:'ddddddddddddddd',email:'client-rc9-canary@primo-pilot.invalid',password:'DisposableOnly'.repeat(3)}
test('only the pinned pilot, product bytes and synthetic scoped actor are accepted',()=>{
 assert.equal(validateActor(actor),actor)
 for(const [key,value]of Object.entries({origin:'https://client.example.com',sourceCommit:'other',nativeSha256:'other',environmentId:'other',siteId:'../other',sectionId:'',headingId:'',userId:'',email:'builder@example.com',password:'short'}))assert.throws(()=>validateActor({...actor,[key]:value}),key)
})
