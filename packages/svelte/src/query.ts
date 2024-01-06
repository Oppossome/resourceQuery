import { Query as BaseQuery } from "@resourcequery/core/src/query"
import { z } from "zod"

import { applySvelteMixin } from "./helpers"

export * from "@resourcequery/core/src/query"

export class Query<Schema extends z.ZodSchema, Args extends any[]> extends applySvelteMixin(
	BaseQuery,
)<Schema, Args> {
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
