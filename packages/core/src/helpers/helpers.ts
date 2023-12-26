export class WeakValueMap<T extends object> {
	#map = new Map<any, WeakRef<T>>()

	#registry = new FinalizationRegistry((key: string) => {
		this.#map.delete(key)
	})

	protected serializeKey(key: any): string {
		return JSON.stringify(key)
	}

	public set(key: any, value: T) {
		key = this.serializeKey(key)
		this.#map.set(key, new WeakRef(value))
		this.#registry.register(value, key)
	}

	public delete(key: any) {
		key = this.serializeKey(key)
		this.#map.delete(key)
		this.#registry.unregister(key)
	}

	public get(key: any): T | undefined {
		key = this.serializeKey(key)
		const value = this.#map.get(key)?.deref()
		return value
	}

	public has(key: any): boolean {
		key = this.serializeKey(key)
		return this.#map.has(key)
	}
}
