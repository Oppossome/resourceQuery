import { z } from "zod"
import { v4 as uuid } from "uuid"

import { Resource, uniqueId } from "./resource"

interface QueryOptions<CacheKey, Result> {
	query: () => Promise<Result>
	cacheKey?: CacheKey
}

/**
 * The Query is a resource that is used to query data from an external source.
 * @template CacheKey The type of the cache key.
 * @template Result The type of the result.
 */
export class Query<CacheKey, Result> extends Resource.resourceExtend({
	cacheKey: uniqueId(z.unknown()),
	result: z.any(),
	error: z.any(),
}) {
	constructor(protected options: QueryOptions<CacheKey, Result>) {
		// If the cache key isn't provided, generate a random one.
		super({ cacheKey: options.cacheKey ?? uuid() })
		this.invalidate() // Kick off the query.
	}

	override get result(): Result | undefined {
		return super.result
	}

	override set result(result: Result | Error | undefined) {
		// If the result is an error, we set the error and clear the result.
		if (result instanceof Error) {
			super.result = undefined
			super.error = result
		}

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

	async invalidate() {
		try {
			this.result = await this.options.query()
		} catch (error) {
			if (error instanceof Error) this.result = error
			else if (typeof error === "string") this.result = new Error(error)
			else this.result = new Error("An unknown error occurred.")
		}
	}
}