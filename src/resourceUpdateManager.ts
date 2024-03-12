import { Metadata, Util } from "./helpers"
import { Resource } from "./resource"

type CacheEntryOf<Method extends CacheEntry["method"]> = Extract<CacheEntry, { method: Method }>
type CacheEntry =
	| { method: "one"; source: typeof Resource; value: Resource | undefined }
	| { method: "many"; source: typeof Resource; value: Resource[] }

export type UpdateCallback = (methods: {
	queryOne: ResourceUpdateManager["queryOne"]
	queryMany: ResourceUpdateManager["queryMany"]
}) => void

export class ResourceUpdateManager {
	#eventListeners = new Set<() => void>()
	#cache = new Array<CacheEntry>()
	#cacheIter = 0

	constructor(protected updateCallback: UpdateCallback) {
		this.#executeCallback()
	}

	#reset() {
		this.#eventListeners.forEach((listener) => listener())
		this.#eventListeners.clear()
		this.#cacheIter = 0
	}

	#isCancelled = false
	cancel() {
		this.#isCancelled = true
		this.#cache = []
		this.#reset()
	}

	get isCancelled() {
		return this.#isCancelled
	}

	#executeDebounce = Util.debounce(100)
	#executeCallback() {
		this.#executeDebounce(() => {
			if (this.isCancelled) return // Don't execute the callback if the update manager has been cancelled
			this.#reset()

			// Call the update callback
			this.updateCallback({
				queryOne: this.queryOne.bind(this),
				queryMany: this.queryMany.bind(this),
			})
		})
	}

	#performQuery<Method extends CacheEntry["method"]>(
		method: Method,
		resource: typeof Resource,
		callback: (cacheEntry: CacheEntryOf<Method> | undefined) => CacheEntryOf<Method>,
	) {
		if (this.isCancelled) throw new Error("Update Manager has been cancelled")
		const cacheIndex = this.#cacheIter++
		const cacheEntry = this.#cache[cacheIndex]

		if (cacheEntry && (cacheEntry.method !== method || cacheEntry.source !== resource)) {
			throw new Error("Queries must be executed in the same order as they were defined")
		}

		this.#cache[cacheIndex] = callback(cacheEntry as CacheEntryOf<Method> | undefined)
		return this.#cache[cacheIndex].value as CacheEntryOf<Method>["value"]
	}

	queryOne<Resource extends typeof Resource>(
		resource: Resource,
		predicate: (resource: InstanceType<Resource>) => boolean,
	) {
		return this.#performQuery("one", resource, (cacheEntry) => {
			cacheEntry ??= {
				method: "one",
				source: resource,
				value: Metadata.get(resource).storage.find((resource) =>
					predicate(resource as InstanceType<Resource>),
				),
			}

			this.#eventListeners.add(
				Metadata.get(resource).onUpdate.subscribe((entry) => {
					// Appease the type checker
					if (!cacheEntry) throw new Error("Cache Entry is missing")

					// If the stored value is undefined and the predicate matches, store the entry and execute the callback
					if (!cacheEntry.value && predicate(entry as InstanceType<Resource>)) {
						cacheEntry.value = entry as InstanceType<Resource>
						return this.#executeCallback()
					}
				}),
			)

			return cacheEntry
		}) as InstanceType<Resource> | undefined
	}

	queryMany<Resource extends typeof Resource>(
		resource: Resource,
		predicate: (resource: InstanceType<Resource>) => boolean,
		source?: InstanceType<Resource>[],
	) {
		return this.#performQuery("many", resource, (cacheEntry) => {
			// QoL - If source is provided and it doesn't match the predicate, throw an error
			if (source && cacheEntry?.value !== source) {
				for (const resource of source) {
					if (!predicate(resource)) {
						throw new Error("Source provided does not match the predicate")
					}
				}
			}

			cacheEntry ??= {
				method: "many",
				source: resource,
				value:
					source ??
					Metadata.get(resource).storage.filter((resource) =>
						predicate(resource as InstanceType<Resource>),
					),
			}

			this.#eventListeners.add(
				Metadata.get(resource).onUpdate.subscribe((entry) => {
					if (!cacheEntry) throw new Error("Cache Entry is missing")
					const entryIndex = cacheEntry.value.indexOf(entry as InstanceType<Resource>)
					const wantsEntry = predicate(entry as InstanceType<Resource>)
					const hasEntry = entryIndex !== -1

					// If the entry is in the cache and the predicate matches, execute the callback
					if (hasEntry && wantsEntry) return this.#executeCallback()

					// If the entry is in the cache and the predicate doesn't match, remove the entry and execute the callback
					if (hasEntry && !wantsEntry) {
						cacheEntry.value.splice(entryIndex, 1)
						return this.#executeCallback()
					}

					// If the entry is not in the cache and the predicate matches, add the entry and execute the callback
					if (!hasEntry && wantsEntry) {
						cacheEntry.value.push(entry as InstanceType<Resource>)
						return this.#executeCallback()
					}
				}),
			)

			return cacheEntry
		}) as InstanceType<Resource>[]
	}
}
