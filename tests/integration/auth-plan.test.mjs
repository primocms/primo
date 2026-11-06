import {test} from 'node:test'
import assert from 'node:assert/strict'
import {authPlan} from '../presence/auth-plan.mjs'

test('default sign-in qualification retains refresh interruption and actual rate-limit coverage', () => {
 const {sessions,timeout}=authPlan({})
 assert.equal(sessions.length,2);assert.equal(timeout,240000)
 assert.equal(sessions[0].profile,'canceled');assert.equal(sessions[1].burst,true)
})
test('stress coverage interleaves normal, canceled and delayed sessions before the real rejection case', () => {
 const {sessions,timeout}=authPlan({PRIMO_AUTH_REPEATS:'20',PRIMO_AUTH_STRESS:'1'})
 assert.equal(sessions.length,61)
 for(const profile of ['normal','canceled','delayed-canceled'])assert.equal(sessions.filter(s=>!s.burst&&s.profile===profile).length,20)
 assert.equal(sessions.filter(s=>s.burst).length,1)
 assert.ok(timeout>=61*15000,'The test budget must include real production auth quiet periods')
 assert.deepEqual(sessions.slice(0,3).map(s=>s.profile),['normal','canceled','delayed-canceled'])
})
test('invalid stress configuration fails before starting any fixture or browser', () => {
 for(const value of ['0','21','1.5','NaN','Infinity','-1'])assert.throws(()=>authPlan({PRIMO_AUTH_REPEATS:value}),/integer from 1 to 20/)
 assert.throws(()=>authPlan({PRIMO_AUTH_STRESS:'true'}),/1 or unset/)
})
