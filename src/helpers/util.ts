/**
 * Function that debounces a function call.
 * @param ms The amount of milliseconds to wait before calling the function.
 */
export function debounce(ms: number) {
	let timeoutId: number | undefined
	return (input: () => void) => {
		if (ms === 0) return input() // No debounce
		if (timeoutId) clearTimeout(timeoutId)
		timeoutId = setTimeout(input, ms)
	}
}

/**
 * A map that holds weak references to its values.
 * @template K The type of the keys.
 * @template {object} V The type of the values.
 */
export class WeakValueMap<K, V extends object> {
	// The map that holds the weak references.
	#map = new Map<K, WeakRef<V>>();

	*[Symbol.iterator](): IterableIterator<[K, V]> {
		for (const [key, value] of this.#map) {
			const storedValue = value.deref()
			if (storedValue !== undefined) {
				yield [key, storedValue]
			}
		}
	}

	clear() {
		this.#map.clear()
	}

	delete(key: K) {
		return this.#map.delete(key)
	}

	filter(callback: (value: V, key: K) => boolean): V[] {
		const values = new Array<V>()
		for (const [key, value] of this) {
			if (callback(value, key)) {
				values.push(value)
			}
		}

		return values
	}

	find(callback: (value: V, key: K) => boolean): V | undefined {
		for (const [key, value] of this) {
			if (callback(value, key)) {
				return value
			}
		}
	}

	forEach(callback: (value: V, key: K) => void) {
		for (const [key, value] of this) {
			callback(value, key)
		}
	}

	get(key: K) {
		return this.#map.get(key)?.deref()
	}

	has(key: K) {
		return this.#map.has(key)
	}

	set(key: K, value: V) {
		this.#map.set(key, new WeakRef(value))
	}
}

/**
 * An event emitter that holds weak references to its subscribers.
 * @template Value The type of the value that will be dispatched.
 *
 * @example
 * const event = new WeakEvent<number>()
 *
 * class MyClass {
 *  constructor() {
 *   event.subscribe((value) => {
 *     console.log(value)
 *   })
 *  }
 * }
 */
export class WeakEventBus<Value> {
	#set = new Set<WeakRef<EventListener<Value>>>()
	#debounce: ReturnType<typeof debounce>

	constructor(ms: number = 0) {
		this.#debounce = debounce(ms)

		// Bind methods for convenience
		this.subscribe = this.subscribe.bind(this)
		this.dispatch = this.dispatch.bind(this)
	}

	/**
	 * Returns a promise that resolves when the event is dispatched and the callback returns true.
	 * @param callback The callback that will be called when the event is dispatched.
	 * @returns A promise that resolves when the event is dispatched.
	 */
	subscribeUntil(callback: (value: Value) => boolean): Promise<Value>

	/**
	 * Returns a promise that resolves when the event is dispatched and the callback returns true.
	 * @param callback The callback that will be called when the event is dispatched.
	 * @returns A promise that resolves when the event is dispatched.
	 */
	subscribeUntil<Subset extends Value>(callback: (value: Value) => value is Subset): Promise<Subset>

	subscribeUntil(callback: (value: Value) => boolean): Promise<Value> {
		return new Promise((resolve) => {
			const unsub = this.subscribe((value) => {
				if (!callback(value)) return
				setTimeout(unsub, 0)
				resolve(value)
			})
		})
	}

	subscribe(listener: EventListener<Value>) {
		const storage = new WeakRef(listener)
		this.#set.add(storage)

		return () => this.#set.delete(storage)
	}

	dispatch(value: Value) {
		this.#debounce(() => {
			for (const listener of this.#set) {
				listener.deref()?.(value)
			}
		})
	}
}

type EventListener<V> = (value: V) => void
