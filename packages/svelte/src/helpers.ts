import { Resource } from "@resourcequery/core"
import { Writable, writable } from "svelte/store"

export function useDebouncedCallback(callback: () => void) {
	let timeout: ReturnType<typeof setTimeout> | undefined
	return () => {
		if (timeout) clearTimeout(timeout)
		timeout = setTimeout(callback, 15)
	}
}

export function applySvelteMixin<Resource extends typeof Resource.Class>(input: Resource) {
	return class SvelteResource extends input {
		constructor(...params: any[]) {
			super(...params)

			const oldSet = this._resourceMetadata.events.set
			this._resourceMetadata.events.set = (key, value) => {
				oldSet(key, value)
				this._dispatchUpdate?.()
			}
		}

		/**
		 * A store that contains the resource. This allows users to subscribe to changes in the resource.
		 * @internal
		 */
		protected _resourceStore: Writable<this> = writable(this)

		subscribe = this._resourceStore.subscribe

		/**
		 * A function that dispatches an update to the underlying store.
		 * @internal
		 */
		protected _dispatchUpdate? = useDebouncedCallback(() => this._resourceStore.set(this))

		override toJSON(): Record<string, unknown> {
			const { _resourceStore, ...rest } = super.toJSON()
			return rest
		}
	}
}
