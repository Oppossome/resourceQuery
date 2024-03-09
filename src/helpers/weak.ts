/**
 * A map that holds weak references to its values.
 * @template K The type of the keys.
 * @template {object} V The type of the values.
 */
export class ValueMap<K, V extends object> {
	// The map that holds the weak references.
	#map = new Map<K, WeakRef<V>>()

	clear() {
		this.#map.clear()
	}

	delete(key: K) {
		return this.#map.delete(key)
	}

	forEach(callback: (value: V, key: K) => void) {
		this.#map.forEach((value, key) => {
			const storedValue = value.deref()
			if (storedValue !== undefined) callback(storedValue, key)
		})
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
 * @template T The type of the value that will be dispatched.
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
export class EventBus<T> {
	#set = new Set<WeakRef<EventListener<T>>>()
	#debounce: ReturnType<typeof debounce>

	constructor(ms: number = 0) {
		this.#debounce = debounce(ms)

		// Bind methods for convenience
		this.subscribe = this.subscribe.bind(this)
		this.dispatch = this.dispatch.bind(this)
	}

	subscribe(listener: EventListener<T>) {
		const storage = new WeakRef(listener)
		this.#set.add(storage)

		return () => this.#set.delete(storage)
	}

	dispatch(value: T) {
		this.#debounce(() => {
			for (const listener of this.#set) {
				listener.deref()?.(value)
			}
		})
	}
}

/**
 * Function that debounces a function call.
 * @param ms The amount of milliseconds to wait before calling the function.
 */
function debounce(ms: number) {
	let timeoutId: number | undefined
	return (input: () => void) => {
		if (ms === 0) return input() // No debounce
		if (timeoutId) clearTimeout(timeoutId)
		timeoutId = setTimeout(input, ms)
	}
}

type EventListener<V> = (value: V) => void
