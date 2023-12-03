import { Resource as CoreResource } from "@resourcequery/core"
import { writable } from "svelte/store"
import { z } from "zod"

export function useDebouncedTimeout(ms: number) {
	let timeout: number | undefined
	return (callback: () => void) => {
		if (timeout) clearTimeout(timeout)
		timeout = setTimeout(callback, ms)
	}
}

export function applySvelteMixin(input: typeof CoreResource) {
	return class SvelteResource extends input {
		/**
		 * A store that contains the resource. This allows users to subscribe to changes in the resource.
		 * @internal
		 */
		protected _resourceStore = writable(this)

		subscribe = this._resourceStore.subscribe

		/**
		 * A function that allows us to debounce the update function to prevent unnecessary updates.
		 * @internal
		 */
		protected _resourceDebouncedTimeout = useDebouncedTimeout(100)

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
					this._resourceDebouncedTimeout(() => this._resourceStore.set(this))
					propValue = parsedValue.data
				},
			})
		}
	}
}
