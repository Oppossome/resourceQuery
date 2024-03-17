import { z } from "zod"
import { F } from "ts-toolbelt"

import { Resource } from "./resource"
import { WeakValueMap } from "./helpers/util"
import { Metadata } from "./helpers"

// prettier-ignore
export interface QueryOptions<Schema extends z.ZodSchema, Props extends any[]> {
	query: (this: Query<Schema, any[]>, schema: Schema, ...props: Props) => Promise<z.infer<Schema> | undefined>
  cacheKey?: (...props: F.NoInfer<Props>) => string
  schema: Schema
}

/**
 * The Query is a resource that is used to query data from an external source.
 * @template CacheKey The type of the cache key.
 * @template Result The type of the result.
 */
export class Query<Schema extends z.ZodSchema, Props extends any[]> extends Resource.resourceExtend(
	{
		loading: z.boolean(),
		result: z.any(),
		error: z.any(),
	},
) {
	protected params: Props

	constructor(
		protected options: QueryOptions<Schema, Props>,
		...params: Props
	) {
		super({ loading: false })
		this.params = params

		// Weakly subscribe to the onGet event, and begin the query if it was called.
		Metadata.get(this).onGet.subscribeUntil(() => {
			this.initialInvalidation()
			return true
		})
	}

	override get result(): z.infer<Schema> | undefined {
		return super.result
	}

	override set result(result: z.infer<Schema> | undefined) {
		super.result = result
		super.error = undefined
	}

	override get error(): Error | undefined {
		return super.error
	}

	override set error(error: Error | undefined) {
		if (error) console.error(error)
		super.error = error
	}

	resolved(): Promise<this> {
		this.initialInvalidation()
		// @ts-expect-error - This is intentional
		return Metadata.get(this).onUpdate.subscribeUntil(() => this.loading === false)
	}

	#wasParameterCalled = false
	protected initialInvalidation() {
		if (this.#wasParameterCalled) return
		this.#wasParameterCalled = true
		this.invalidate()
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
			const typedThis = this as unknown as Query<Schema, any[]>
			const result = await this.options.query.call(typedThis, this.options.schema, ...this.params)
			if (result !== undefined) this.result = result
		} catch (error) {
			if (error instanceof Error) this.error = error
			else if (typeof error === "string") this.error = new Error(error)
			else this.error = new Error("An unknown error occurred.")
		}

		this.loading = false
	}

	static defineQuery<Schema extends z.ZodSchema, Props extends any[]>(
		options: QueryOptions<Schema, Props>,
	) {
		return new Manager(options, (...props: Props) => new Query(options, ...props)).callback()
	}
}

export class Manager<
	Schema extends z.ZodSchema,
	Props extends any[],
	Output extends Query<Schema, Props>,
> {
	#callback: (...props: Props) => Output
	#options: QueryOptions<Schema, Props>

	constructor(options: QueryOptions<Schema, Props>, callback: (...props: Props) => Output) {
		this.#options = options
		this.#callback = callback
	}

	#cache = new WeakValueMap<string, Output>()

	callback() {
		return (...props: Props) => {
			const cacheKey = this.#options.cacheKey?.(...props) ?? JSON.stringify(props)

			// If the query is already in the cache, return it.
			const cachedQuery = this.#cache.get(cacheKey)
			if (cachedQuery) return cachedQuery

			const query = this.#callback(...props)
			this.#cache.set(cacheKey, query)
			return query
		}
	}
}
