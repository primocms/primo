import { SvelteMap } from 'svelte/reactivity'

/**
 * SvelteMap that determines order based initial "set" call. Calls to set with
 * existing id, aka. overwrites, does not change the order.
 */
export class OrderedSvelteMap<K, V> extends SvelteMap<K, V> {
	private order: K[] = []

	private *iterator(): IterableIterator<[K, V]> {
		for (const key of this.order) {
			const value = super.get(key) as V
			yield [key, value]
		}
	}

	forEach(callbackfn: (value: V, key: K, thisArg?: any) => void): void {
		for (const [key, value] of this.iterator()) {
			callbackfn(value, key, this)
		}
	}

	set(key: K, value: V): this {
		if (!this.order.includes(key)) {
			this.order.push(key)
		}

		super.set(key, value)
		return this
	}

	delete(key: K): boolean {
		this.order = this.order.filter((k) => k !== key)
		return super.delete(key)
	}

	clear(): void {
		this.order = []
		super.clear()
	}

	*keys(): IterableIterator<K> {
		super.keys()
		for (const [key] of this.iterator()) yield key
	}

	*values(): IterableIterator<V> {
		super.values()
		for (const [, value] of this.iterator()) yield value
	}

	entries(): IterableIterator<[K, V]> {
		super.entries()
		return this.iterator()
	}

	[Symbol.iterator]() {
		return this.entries()
	}
}
