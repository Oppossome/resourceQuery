import { z } from "zod"

import * as Resource from "./resource"

export interface QueryOptions<Schema extends z.ZodSchema, Args extends any[]> {
	schema: Schema
	getCacheKey?: (...params: Args) => string
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

	static define<Schema extends z.ZodSchema, Args extends any[]>(
		options: QueryOptions<Schema, Args>,
	) {
		return (...args: Args) => new this(options, ...args)
	}
}
