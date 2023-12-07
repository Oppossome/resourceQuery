import { Resource as BaseResource, Query as BaseQuery, QueryOptions } from "@resourcequery/core"

import { applySvelteMixin } from "./helpers"

export { uniqueId, updatedOn, type QueryOptions } from "@resourcequery/core"

/**
 * Define a query class that extends the CoreResource class.
 */
export const Resource = applySvelteMixin(BaseResource)

export class Query<const Opts extends QueryOptions> extends applySvelteMixin(BaseQuery)<Opts> {
	public resolved(): Promise<this> {
		return new Promise((resolve) => {
			const unsub = this.subscribe((resource) => {
				if (resource.status === "PENDING") return
				console.log("Resolving at", resource.status)
				resolve(resource)
				setTimeout(unsub)
			})
		})
	}
}
