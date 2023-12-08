import { Resource as BaseResource, Query as BaseQuery } from "@resourcequery/core"
import { z } from "zod"

import { applySvelteMixin } from "./helpers"

export { uniqueId, updatedOn, type QueryOptions } from "@resourcequery/core"

/**
 * Define a query class that extends the CoreResource class.
 */
export const Resource = applySvelteMixin(BaseResource)

export class Query<CacheKey, Schema extends z.ZodSchema> extends applySvelteMixin(BaseQuery)<
	CacheKey,
	Schema
> {
	public resolved(): Promise<this> {
		return new Promise((resolve) => {
			const unsub = this.subscribe((resource) => {
				if (resource.status === "PENDING") return
				resolve(resource)
				setTimeout(unsub)
			})
		})
	}
}
