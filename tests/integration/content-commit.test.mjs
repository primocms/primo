import {test} from 'node:test'
import assert from 'node:assert/strict'
import {observeContentCommit} from '../../src/lib/builder/content_commit.js'

test('detached content autosave failures are reported through the UI and success stays distinct',async()=>{
 const failure={status:0},errors=[];let saved=0
 const callbacks={onSaved:()=>saved++,onError:error=>errors.push(error)}
 await observeContentCommit(Promise.reject(failure),callbacks)
 assert.deepEqual(errors,[failure]);assert.equal(saved,0)
 await observeContentCommit(Promise.resolve(),callbacks)
 assert.equal(saved,1);assert.deepEqual(errors,[failure])
})
