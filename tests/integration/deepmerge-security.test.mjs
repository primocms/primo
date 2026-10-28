import { test } from 'node:test'
import assert from 'node:assert/strict'
import merge from 'deepmerge'

test('configuration merge cannot give results an attacker-controlled prototype', () => {
	const attack = JSON.parse('{"__proto__":{"isAdmin":true}}')
	const targets = [Object.create(null), JSON.parse('{"__proto__":null}'), JSON.parse('{"__proto__":{"existing":true}}')]
	for (const target of targets) {
		for (const [left, right] of [
			[target, attack],
			[attack, target]
		]) {
			const result = merge(left, right)
			assert.equal(Object.getPrototypeOf(result), Object.prototype)
			assert.equal(result.isAdmin, undefined)
			assert.equal(Object.hasOwn(result, '__proto__'), false)
		}
	}
	const nested = merge({ session: null }, JSON.parse('{"session":{"__proto__":{"isAdmin":true}}}'))
	assert.equal(Object.getPrototypeOf(nested.session), Object.prototype)
	assert.equal(nested.session.isAdmin, undefined)
	assert.equal({}.isAdmin, undefined)
})

test('configuration merge keeps nested options, arrays, symbols and merge customizations', () => {
	const symbol = Symbol('option'),
		left = { nested: { left: true }, list: [{ id: 1 }], [symbol]: 1 }
	const right = { nested: { right: true }, list: [{ id: 2 }], [symbol]: 2 }
	const result = merge.all([left, right])
	assert.deepEqual(result.nested, { left: true, right: true })
	assert.deepEqual(result.list, [{ id: 1 }, { id: 2 }])
	assert.equal(result[symbol], 2)
	assert.notEqual(result.list[0], left.list[0])
	assert.deepEqual(left.list, [{ id: 1 }])
	assert.deepEqual(merge(left, right, { arrayMerge: (_target, source) => source }).list, [{ id: 2 }])
	assert.deepEqual(merge({ nested: { a: 1 } }, { nested: { b: 2 } }, { customMerge: (key) => (key === 'nested' ? () => ({ custom: true }) : undefined) }), { nested: { custom: true } })
	const date = new Date(0),
		regexp = /safe/
	const special = merge({}, { date, regexp })
	assert.equal(special.date, date)
	assert.equal(special.regexp, regexp)
})
