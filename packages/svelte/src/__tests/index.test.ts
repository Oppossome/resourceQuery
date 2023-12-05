import { z } from "zod"
import { it, describe } from "vitest"
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
				await wait(500) // Wait for a bit
				return test
			})
		})
	})
})
