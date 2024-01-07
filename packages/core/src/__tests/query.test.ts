import { vi, it, expect, describe } from "vitest"
import { z } from "zod"

import { Query, QueryManager, QueryOptions } from "../query"

const defineOptions = <Schema extends z.ZodSchema, Args extends any[]>(
	config: QueryOptions<Schema, Args>,
) => config

function generateQuery(partial?: Partial<QueryOptions<any, any>>) {
	const queryOptions = defineOptions({
		schema: z.object({ name: z.string() }),
		query: async (schema, name: string) => {
			return schema.parse({ name })
		},
		...partial,
	})

	return {
		query: Query.define(queryOptions),
		options: queryOptions,
	}
}

describe("Query", () => {
	it("You should be able to get the manager from the query", () => {
		const { query } = generateQuery()
		const testManager = QueryManager.getManager(query)

		// Ensure that the manager is the same as the one returned from the query
		expect(testManager!.builder).toBe(query)
	})

	it("Should cache the result of the query", async () => {
		const { query, options } = generateQuery()
		const querySpy = vi.spyOn(options, "query")

		expect(querySpy).not.toHaveBeenCalled()
		query("test")

		expect(querySpy).toHaveBeenCalledTimes(1)
		query("test")

		expect(querySpy).toHaveBeenCalledTimes(1)
		query("test2")

		expect(querySpy).toHaveBeenCalledTimes(2)
	})
})
