import { z } from "zod"

import * as Resource from "./resource"
import { WeakValueMap } from "./helpers/helpers"

export interface QueryOptions<Schema extends z.ZodSchema, Args extends any[]> {
	schema: Schema
	/**
	 * Provide a this that makes it easier to access some useful things.
	 *  - serializeObject: Stringifies the arguments {Sorted Object Keys}
	 */
	getCacheKey?: (...args: Args) => string
	query: (
		this: Query<Schema, any[]>,
		schema: Schema,
		...args: Args
	) => Promise<z.infer<Schema> | undefined>
}

/**
 * The Query is a resource that is used to query data from an external source.
 * @template CacheKey The type of the cache key.
 * @template Result The type of the result.
 */
export class Query<
	Schema extends z.ZodSchema,
	Args extends any[],
> extends Resource.Class.resourceExtend({
	loading: z.boolean(),
	result: z.any(),
	error: z.any(),
}) {
	protected queryArgs!: Args

	constructor(
		protected options: QueryOptions<Schema, Args>,
		...args: Args
	) {
		super({ loading: false })

		this.queryArgs = args
		this.invalidate()
	}

	override get result(): z.infer<Schema> | undefined {
		return super.result
	}

	override set result(result: z.infer<Schema> | Error | undefined) {
		// Order Matters: status goes from "SUCCESS" to "ERROR"
		if (result instanceof Error) {
			this.error = result
			super.result = undefined
		}

		// Order Matters: status goes from "ERROR" to "SUCCESS"
		super.result = result
		this.error = undefined
	}

	override get error(): Error | undefined {
		return super.error
	}

	override set error(error: Error | undefined) {
		if (error) console.error(error)
		super.error = error
	}

	/**
	 * Invalidates the query and re-runs it.
	 */
	async invalidate() {
		// If the query is already loading, don't run it again.
		if (this.loading) return
		this.loading = true

		// Run the query, and set the result if its returned.
		try {
			// @ts-expect-error - Because the query method is passed any[] for Args to prevent self-referencing
			const result = await this.options.query.call(this, this.options.schema, ...this.queryArgs)
			if (result !== undefined) this.result = result
		} catch (error) {
			if (error instanceof Error) this.result = error
			else if (typeof error === "string") this.result = new Error(error)
			else this.result = new Error("An unknown error occurred.")
		}

		this.loading = false
	}

	/**
	 * Defines a query function.
	 * @param options The options for the query.
	 * @returns A query builder.
	 */
	static define<Schema extends z.ZodSchema, Args extends any[]>(
		options: QueryOptions<Schema, Args>,
	) {
		return new QueryManager<Schema, Args, Query<Schema, Args>>(options, (...args) => {
			return new Query(options, ...args)
		}).builder
	}
}

// prettier-ignore
export type QueryBuilder<
	Schema extends z.ZodSchema = any,
	Args extends any[] = any,
	Result extends Query<any, any> = any
> =
	QueryManager<Schema, Args, Result>["builder"]

export class QueryManager<
	Schema extends z.ZodSchema,
	Args extends any[],
	Result extends Query<any, any>,
> {
	protected static managerLookup = new Map<QueryBuilder, QueryManager<any, any, any>>()
	queryCache = new WeakValueMap<Query<Schema, Args>>()

	constructor(
		protected options: QueryOptions<Schema, Args>,
		protected callback: (...args: Args) => Result,
	) {
		QueryManager.managerLookup.set(this.builder, this)
	}

	getCacheKey(...args: Args) {
		const defaultCachekey = JSON.stringify(args)
		return this.options.getCacheKey?.(...args) ?? defaultCachekey
	}

	builder = (...args: Args) => {
		// Stringify the arguments for now, the user gets the option to override this.
		const cacheKey = this.getCacheKey(...args)

		// If the query is already cached, return it.
		const cachedValue = this.queryCache.get(cacheKey)
		if (cachedValue) return cachedValue as Result

		// If the query is not cached, run it and cache it.
		const uncachedValue = this.callback(...args)
		this.queryCache.set(cacheKey, uncachedValue)
		return uncachedValue as Result
	}

	static getManager<Schema extends z.ZodSchema, Args extends any[], Result extends Query<any, any>>(
		builder: QueryBuilder<Schema, Args, Result>,
	): QueryManager<Schema, Args, Result> | undefined {
		return this.managerLookup.get(builder) as QueryManager<Schema, Args, Result> | undefined
	}
}
