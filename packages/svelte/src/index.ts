import {
	Query as BaseQuery,
	Resource as BaseResource,
	ResourceClass as BaseResourceClass,
} from "@resourcequery/core"
import { z } from "zod"

import { applySvelteMixin } from "./helpers"

export { type QueryOptions, type InferResource } from "@resourcequery/core"

/**
 * Define a query class that extends the CoreResource class.
 */
export const ResourceClass = applySvelteMixin(BaseResourceClass)

export const Resource = {
	...BaseResource,
	resourceExtend: <NewShape extends z.ZodRawShape>(shape: NewShape) =>
		ResourceClass.resourceExtend(shape),
}

export class Query<Schema extends z.ZodSchema> extends applySvelteMixin(BaseQuery)<Schema> {
	public resolved(): Promise<this> {
		return new Promise((resolve) => {
			const unsub = this.subscribe((resource) => {
				if (!resource.loading) return
				resolve(resource)
				setTimeout(unsub)
			})
		})
	}
}
