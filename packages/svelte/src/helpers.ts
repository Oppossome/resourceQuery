import { Resource as CoreResource } from "@resourcequery/core"
import { Writable, writable } from "svelte/store"
import { z } from "zod"

export function useDebouncedCallback(callback: () => void, ms: number = 250) {
	let timeout: ReturnType<typeof setTimeout> | undefined
	return () => {
		if (timeout) clearTimeout(timeout)
		timeout = setTimeout(callback, ms)
	}
}

export function applySvelteMixin<Resource extends typeof CoreResource>(input: Resource) {
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
		protected _dispatchUpdate? = useDebouncedCallback(() => {
			this._resourceStore.set(this)
		})

		override toJSON(): Record<string, unknown> {
			const { _resourceStore, ...rest } = super.toJSON()
			return rest
		}

		/**
		 * Override the default _resourceDefineProperty function to update the store when a property is set.
		 * @internal
		 */
		protected override _resourceDefineProperty(key: string, schema: z.ZodTypeAny): void {
			let propValue: unknown

			Object.defineProperty(this, key, {
				get: () => propValue,
				set: (value: unknown) => {
					// Because we're parsing the input
					const lastResourcesMetadata = CoreResource._resourceUpdating
					CoreResource._resourceUpdating = this._resourceMetadata

					// Safely parse the input so we can return _resourceUpdating to its original value
					const parsedValue = schema.safeParse(value)
					CoreResource._resourceUpdating = lastResourcesMetadata

					// If the input is invalid, throw the error, otherwise assign the parsed value to the propValues object
					if (!parsedValue.success) throw parsedValue.error
					propValue = parsedValue.data
					this._dispatchUpdate?.() // Dispatch an update to the store, if it exists.
				},
			})
		}
	}
}
