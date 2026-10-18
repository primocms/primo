import assert from 'node:assert/strict'
import {test} from 'node:test'
import {observeSubscription} from '../../src/lib/pocketbase/subscription.js'

test('navigation-canceled realtime registrations settle without an unhandled rejection', async () => {
	const errors=[]
	for(const error of [{isAbort:true},{status:0,isAbort:false}])await observeSubscription(Promise.reject(error),error=>errors.push(error))
	assert.deepEqual(errors,[])
})

test('unexpected realtime registration failures remain visible', async () => {
	const errors=[],permission={status:403},server={status:503}
	await observeSubscription(Promise.reject(permission),error=>errors.push(error))
	await observeSubscription(Promise.reject(server),error=>errors.push(error))
	assert.deepEqual(errors,[permission,server])
})

test('successful subscription registration retains the SDK listener and unsubscribe handle', async () => {
	let unsubscribed=false
	const unsubscribe=()=>{unsubscribed=true},registration=Promise.resolve(unsubscribe)
	await observeSubscription(registration,()=>assert.fail('Successful registration must not report an error'))
	assert.equal(unsubscribed,false);assert.equal(await registration,unsubscribe)
})
