import { z } from "zod"
import { it, describe, expect } from "vitest"
import { wait, expectGC } from "@resourcequery/core/src/__tests/helpers"

import { Resource } from ".."

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
	})
})
