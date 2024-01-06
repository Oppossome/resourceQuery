import { z } from "zod"
import { it, describe, expect } from "vitest"
import { wait, expectGC } from "@resourcequery/core/src/__tests/helpers"

import { Resource, Query } from ".."

class TestResource extends Resource.resourceExtend({
	value: z.number(),
}) {}

describe("helpers", () => {
	describe("Resource", () => {
		it("should garbagecollect without issue", async () => {
			await expectGC(async () => {
				const test = new TestResource({ value: 123 })
				await wait(500) // Wait for the initial debounce to finish
				return test
			})
		})

		it("Should serialize to JSON without any internal fields", () => {
			const jsonOutput = JSON.stringify(new TestResource({ value: 123 }))
			expect(jsonOutput).toStrictEqual('{"value":123}')
		})

		it("Should resolve to a known result", async () => {
			const myQuery = new Query({
				schema: z.object({ test: TestResource.resourceSchema() }),
				query: async function (schema) {
					return schema.parse({ test: { value: 123 } })
				},
			})

			// Expect the query to be loading
			expect(myQuery.loading).toBe(true)
			await myQuery.resolved()

			// Expect the query to be resolved
			expect(myQuery.loading).toBe(false)
			expect(myQuery.result?.test.value).toBe(123)
		})
	})
})
