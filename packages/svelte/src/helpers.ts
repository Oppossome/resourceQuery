import { ResourceClass } from "@resourcequery/core"
import { Writable, writable } from "svelte/store"
import { z } from "zod"

export function useDebouncedCallback(callback: () => void) {
	let timeout: ReturnType<typeof setTimeout> | undefined
	return () => {
		if (timeout) clearTimeout(timeout)
		timeout = setTimeout(callback, 15)
	}
}

export function applySvelteMixin<Resource extends typeof ResourceClass>(input: Resource) {
	return class SvelteResource extends input {
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

		/**
		 * Override the default _resourceDefineProperty function to update the store when a property is set.
		 * @internal
		 */
		protected override _resourceDefineProperty(key: string, schema: z.ZodTypeAny): void {
			// Call the original _resourceDefineProperty function, but also update dispatch an update to the store.
			super._resourceDefineProperty(key, schema, () => this._dispatchUpdate?.())
		}
	}
}
