import * as Query from "@resourcequery/core/src/query"
import { z } from "zod"

import { applySvelteMixin } from "./helpers"

export * from "@resourcequery/core/src/query"

export class Class<Schema extends z.ZodSchema> extends applySvelteMixin(Query.Class)<Schema> {
	public resolved(): Promise<this> {
		return new Promise((resolve) => {
			const unsub = this.subscribe((resource) => {
				if (!resource.loading) return
				resolve(resource)
				setTimeout(unsub)
			})
		})
	}

	static override defineQuery<Schema extends z.ZodSchema>(options: Query.Options<Schema>) {
		return new Class<Schema>(options)
	}
}

export function defineQuery<Schema extends z.ZodSchema>(options: Query.Options<Schema>) {
	return Class.defineQuery(options)
}
