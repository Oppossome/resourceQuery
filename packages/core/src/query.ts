import { z } from "zod"
import { v4 as uuid } from "uuid"

import { Resource, uniqueId } from "./resource"

export interface QueryOptions {
	cacheKey?: any
	query: () => Promise<any>
}

/**
 * The Query is a resource that is used to query data from an external source.
 * @template CacheKey The type of the cache key.
 * @template Result The type of the result.
 */
export class Query<const Opts extends QueryOptions> extends Resource.resourceExtend({
	cacheKey: uniqueId(z.unknown()),
	result: z.any(),
	error: z.any(),
}) {
	constructor(protected options: Opts) {
		// If the cache key isn't provided, generate a random one.
		super({ cacheKey: options.cacheKey ?? uuid() })
	}

	override get result(): Awaited<ReturnType<Opts["query"]>> | undefined {
		return super.result
	}

	override set result(result: Awaited<ReturnType<Opts["query"]>> | Error | undefined) {
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
		try {
			this.result = await this.options.query()
		} catch (error) {
			if (error instanceof Error) this.result = error
			else if (typeof error === "string") this.result = new Error(error)
			else this.result = new Error("An unknown error occurred.")
		}
	}
}
