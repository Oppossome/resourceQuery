import { z } from "zod"
import { v4 as uuid } from "uuid"

import { Resource, uniqueId } from "./resource"

export interface QueryOptions<CacheKey, Schema extends z.ZodSchema> {
	schema: Schema
	cacheKey?: CacheKey
	query: (this: Query<CacheKey, Schema>, schema: Schema) => Promise<z.infer<Schema> | undefined>
}

/**
 * The Query is a resource that is used to query data from an external source.
 * @template CacheKey The type of the cache key.
 * @template Result The type of the result.
 */
export class Query<CacheKey, Schema extends z.ZodSchema> extends Resource.resourceExtend({
	cacheKey: uniqueId(z.unknown()),
	isLoading: z.boolean(),
	result: z.any(),
	error: z.any(),
}) {
	constructor(protected options: QueryOptions<CacheKey, Schema>) {
		// If the cache key isn't provided, generate a random one.
		super({ cacheKey: options.cacheKey ?? uuid(), isLoading: false })
		this.invalidate()
	}

	override get result(): z.infer<Schema> | undefined {
		return super.result
	}

	override set result(result: z.infer<Schema> | Error | undefined) {
		// Order Matters: status goes from "SUCCESS" to "ERROR"
		if (result instanceof Error) {
			super.error = result
			super.result = undefined
		}

		// Order Matters: status goes from "ERROR" to "SUCCESS"
		super.result = result
		super.error = undefined
	}

	override get error(): Error | undefined {
		return super.error
	}

	get status() {
		switch (true) {
			case this.error !== undefined:
				return "ERROR"
			case this.result !== undefined:
				return "SUCCESS"
			default:
				return "PENDING"
		}
	}

	/**
	 * Invalidates the query and re-runs it.
	 */
	async invalidate() {
		// If the query is already loading, don't run it again.
		if (this.isLoading) return
		this.isLoading = true

		// Run the query, and set the result if its returned.
		try {
			const result = await this.options.query.call(this, this.options.schema)
			if (result !== undefined) this.result = result
		} catch (error) {
			if (error instanceof Error) this.result = error
			else if (typeof error === "string") this.result = new Error(error)
			else this.result = new Error("An unknown error occurred.")
		}

		this.isLoading = false
	}
}
