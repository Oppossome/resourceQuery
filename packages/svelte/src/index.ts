import { Query as ResourceQuery } from "@resourcequery/core"
import { z } from "zod"

import { applySvelteMixin } from "./helpers"

export * from "@resourcequery/core"
export * as Resource from "./resource"

export class Query<Schema extends z.ZodSchema> extends applySvelteMixin(ResourceQuery)<Schema> {
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
